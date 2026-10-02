import type de from '../de/system';
import type { DictOf } from '../../types';

const system: DictOf<typeof de> = {
  tabs: {
    today: 'Today',
    history: 'History',
    crew: 'Crew',
    contract: 'Contract',
  },
  reminders: {
    channel: 'Reminders',
    startEveTitle: 'Tomorrow’s the day',
    startEveBody: 'Your {title} starts tomorrow. Get everything ready tonight.',
    firstDayTitle: 'Day 1. Let’s go.',
    firstDayBody: 'Your {title} starts today. You signed – now every day counts.',
    dayTitle: 'Day {day} of {total}',
    morningLines: [
      'One day at a time. Today counts.',
      'No bargaining. Just start.',
      'The wall won’t get smaller. You’ll get stronger.',
      'Discipline is what you do when nobody’s watching.',
      'Small steps, every day.',
      'Show yourself today who you want to be.',
      'Motivation comes and goes. Your rules stay.',
    ],
    eveningThinIce: {
      one: 'Missed yesterday – don’t miss today too. {count} rule still open.',
      other: 'Missed yesterday – don’t miss today too. {count} rules still open.',
    },
    eveningOpen: {
      one: '{count} rule still open. You’ve got this.',
      other: '{count} rules still open. You’ve got this.',
    },
    eveningLater: 'All checked off? There’s still time.',
    checkInTitle: 'Check-in',
    lastDayTitle: 'Last day of your arc',
    reviewTitle: 'Weekly review',
    reviewBody: 'Two minutes: what went well, and what will you take on next week?',
  },
  push: {
    noProject: 'The app isn’t linked to an Expo project yet (npx eas-cli@latest init).',
    simulator: 'Push only works on a real phone.',
    web: 'Push is only available in the app.',
    denied: 'Allow notifications for Nordwand in your phone’s settings.',
    signedOut: 'Sign in first.',
    failed: 'That didn’t work. Please try again later.',
  },
  auth: {
    notConfigured: 'Sync isn’t set up yet.',
    mailFailed: 'The email couldn’t be sent. Check the SMTP settings in Supabase (host, port 587, app password).',
    wrongPassword: 'Wrong email or password.',
    wrongCode: 'The code is wrong or has expired.',
    tooMany: 'Too many attempts. Wait a moment and try again.',
    invalidEmail: 'This email address is invalid.',
  },
  sync: {
    crew: 'Crew: {error}',
    profile: 'Profile: {error}',
    photos: 'Photos: {error}',
    photosDelete: 'Photos couldn’t be deleted: {error}',
  },
  moderation: {
    blocked: 'We can’t show that. Please choose different wording.',
  },
};

export default system;
