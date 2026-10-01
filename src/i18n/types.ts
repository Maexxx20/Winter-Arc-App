/** Ein Text, eine Liste (z. B. Wochentage) oder Einzahl/Mehrzahl. */
export type Plural = { one: string; other: string };
export type Leaf = string | readonly string[] | Plural;

/** Gleiche Struktur wie das deutsche Wörterbuch – fehlt ein Text, meldet TypeScript einen Fehler. */
export type DictOf<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly string[]
      ? readonly string[]
      : T[K] extends Plural
        ? Plural
        : DictOf<T[K]>;
};

type IsLeaf<V> = V extends string ? true : V extends readonly string[] ? true : V extends Plural ? true : false;

/** Alle Schlüssel als "namespace.key" */
export type Paths<T> = {
  [K in keyof T & string]: IsLeaf<T[K]> extends true ? K : T[K] extends object ? `${K}.${Paths<T[K]>}` : never;
}[keyof T & string];

/** Nur Schlüssel, die auf Listen zeigen */
export type ListPaths<T> = {
  [K in keyof T & string]: T[K] extends readonly string[] ? K : T[K] extends string ? never : T[K] extends Plural ? never : T[K] extends object ? `${K}.${ListPaths<T[K]>}` : never;
}[keyof T & string];
