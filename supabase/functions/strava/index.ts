// Nordwand – Edge Function «strava»
// Verbindet ein Nordwand-Konto mit Strava und liefert die Trainings der letzten Tage.
// Das Client-Secret von Strava bleibt hier auf dem Server und kommt nie in die App.
//
// Benötigte Secrets (Supabase → Edge Functions → Secrets):
//   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
// SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY stellt Supabase selbst bereit.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Connection {
  user_id: string;
  athlete_id: number;
  athlete_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function stravaToken(params: Record<string, string>) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  if (!res.ok) throw new Error(`strava_token_${res.status}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete?: { id: number; firstname?: string; lastname?: string };
  };
}

/** Gültigen Zugang holen, bei Bedarf erneuern. */
async function freshConnection(userId: string): Promise<Connection | null> {
  const { data } = await admin.from('strava_connections').select('*').eq('user_id', userId).maybeSingle<Connection>();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() > Date.now() + 120_000) return data;
  const t = await stravaToken({ grant_type: 'refresh_token', refresh_token: data.refresh_token });
  const next = {
    ...data,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(t.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await admin.from('strava_connections').update(next).eq('user_id', userId);
  return next;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'not_configured' }, 503);

  // Wer ruft auf? (Supabase-Anmeldung der App)
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'not_authenticated' }, 401);

  let body: { action?: string; code?: string; after?: number } = {};
  try {
    body = await req.json();
  } catch {
    // leerer Body
  }

  try {
    switch (body.action) {
      case 'config':
        return json({ clientId: CLIENT_ID });

      case 'status': {
        const { data } = await admin.from('strava_connections').select('athlete_name').eq('user_id', user.id).maybeSingle();
        return json({ connected: !!data, athleteName: data?.athlete_name ?? null });
      }

      case 'connect': {
        if (!body.code) return json({ error: 'missing_code' }, 400);
        const t = await stravaToken({ grant_type: 'authorization_code', code: body.code });
        const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ');
        const { error } = await admin.from('strava_connections').upsert({
          user_id: user.id,
          athlete_id: t.athlete?.id ?? 0,
          athlete_name: name,
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          expires_at: new Date(t.expires_at * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        return json({ connected: true, athleteName: name });
      }

      case 'activities': {
        const conn = await freshConnection(user.id);
        if (!conn) return json({ error: 'not_connected' }, 404);
        // Höchstens 14 Tage zurück
        const after = Math.max(Number(body.after) || 0, Math.floor(Date.now() / 1000) - 14 * 86400);
        const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, {
          headers: { Authorization: `Bearer ${conn.access_token}` },
        });
        if (res.status === 401) return json({ error: 'not_connected' }, 404);
        if (!res.ok) throw new Error(`strava_activities_${res.status}`);
        const list = (await res.json()) as {
          start_date: string;
          start_date_local: string;
          moving_time: number;
          sport_type?: string;
          type?: string;
        }[];
        // Nur, was die App braucht: Tag, Beginn, Dauer, Sportart
        return json({
          activities: list.map((a) => ({
            startLocal: a.start_date_local,
            start: a.start_date,
            minutes: Math.round(a.moving_time / 60),
            sport: a.sport_type ?? a.type ?? '',
          })),
        });
      }

      case 'disconnect': {
        const conn = await freshConnection(user.id).catch(() => null);
        if (conn) {
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: conn.access_token }),
          }).catch(() => undefined);
        }
        await admin.from('strava_connections').delete().eq('user_id', user.id);
        return json({ connected: false });
      }

      default:
        return json({ error: 'unknown_action' }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
