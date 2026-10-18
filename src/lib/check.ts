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
