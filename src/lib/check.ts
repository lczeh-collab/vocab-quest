// Forgiving answer checking for the typing game.

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function clean(s: string) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // "(sth)" hints in the notebook
    .replace(/[.,!?;:"']/g, "")
    .replace(/^(to|a|an|the)\s+/, "") // "to run" == "run"
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type Verdict = "correct" | "accent" | "typo" | "wrong";

/** The expected answer may hold several options: "nice, kind / pleasant". */
export function checkAnswer(given: string, expected: string): Verdict {
  const g = clean(given);
  if (!g) return "wrong";
  const options = [expected, ...expected.split(/[,/;]/)].map(clean).filter(Boolean);
  if (options.includes(g)) return "correct";
  if (options.some((o) => stripAccents(o) === stripAccents(g))) return "accent";
  if (options.some((o) => o.length > 3 && distance(o, g) === 1)) return "typo";
  return "wrong";
}

/**
 * Turns an example sentence into a clue by blanking out the word or expression,
 * including simple other forms ("look forward to" → "She is _______ _______ __ the holiday").
 * Returns null when the word can't be found, so the clue never gives the answer away.
 */
export function gapSentence(sentence: string, expected: string): string | null {
  const words = expected
    .replace(/\(.*?\)/g, " ")
    .trim()
    .replace(/^to\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  // A short stem matches other endings: make → making, study → studied, look → looking.
  const stem = (w: string) => {
    const s = w.toLowerCase().replace(/[^\p{L}'-]/gu, "");
    return s.length > 3 ? s.replace(/[ey]$/, "") : s;
  };
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}])${words.map((w) => `${escape(stem(w))}\\p{L}*`).join("\\s+")}(?![\\p{L}])`, "iu");
  if (!pattern.test(sentence)) return null;
  return sentence.replace(pattern, (m) => m.replace(/\p{L}/gu, "_"));
}
