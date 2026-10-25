import { shuffle } from "./leitner";
import type { Word } from "./types";

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z' ]/g, "").trim();

function bigrams(s: string) {
  const t = s.replace(/\s+/g, " ");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** How alike two English words look and sound: same start, shared letter pairs, similar length. */
export function similarity(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  let prefix = 0;
  while (prefix < Math.min(x.length, y.length, 4) && x[prefix] === y[prefix]) prefix++;
  const bx = bigrams(x);
  const by = bigrams(y);
  const shared = [...bx].filter((g) => by.has(g)).length;
  const dice = bx.size + by.size ? (2 * shared) / (bx.size + by.size) : 0;
  return prefix * 3 + dice * 6 - Math.abs(x.length - y.length) * 0.5;
}

/**
 * Wrong options for a listening question: her own words that sound most like the
 * right one (a little random among the closest, so rounds don't repeat).
 */
export function similarWords(target: Word, all: Word[], count: number): Word[] {
  const key = norm(target.en);
  const seen = new Set([key]);
  const candidates = all.filter((w) => {
    const k = norm(w.en);
    if (!k || seen.has(k) || w.hu.trim().toLowerCase() === target.hu.trim().toLowerCase()) return false;
    // "umbrella stand" for "umbrella" would be unfair: the right word is heard inside it.
    if (k.includes(key) || key.includes(k)) return false;
    seen.add(k);
    return true;
  });
  const ranked = candidates.map((w) => ({ w, s: similarity(target.en, w.en) })).sort((p, q) => q.s - p.s);
  return shuffle(ranked.slice(0, count + 2)).slice(0, count).map((r) => r.w);
}
