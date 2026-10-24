// The active player is kept in a session cookie: it lasts until the browser is
// closed, is shared by all tabs, and the proxy can read it to redirect to /players.
export const PLAYER_COOKIE = "vq_player";

/**
 * Full page load (not client-side navigation), so every page and the header
 * start over with the newly chosen player.
 */
export function reloadTo(path: string) {
  location.href = path;
}

export function getPlayerId(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${PLAYER_COOKIE}=([^;]+)`));
  if (!match) {
    // Every page that loads data runs after the player was chosen; the proxy enforces it.
    reloadTo("/players");
    throw new Error("No active player");
  }
  return decodeURIComponent(match[1]);
}

export function setPlayerId(id: string) {
  document.cookie = `${PLAYER_COOKIE}=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
}

export function clearPlayerId() {
  document.cookie = `${PLAYER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export const AVATARS = ["🦄", "🐱", "🦊", "🐼", "🐸", "🐙", "🦖", "🐝", "🚀", "⚽", "🎸", "🌸", "🍕", "🌈", "👑", "🎨"];

// Full class names so Tailwind includes them in the build.
export const COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  grape: { bg: "bg-violet-500", ring: "ring-violet-300", text: "text-violet-600" },
  pink: { bg: "bg-pink-500", ring: "ring-pink-300", text: "text-pink-600" },
  sky: { bg: "bg-sky-500", ring: "ring-sky-300", text: "text-sky-600" },
  mint: { bg: "bg-emerald-500", ring: "ring-emerald-300", text: "text-emerald-600" },
  sun: { bg: "bg-amber-400", ring: "ring-amber-200", text: "text-amber-600" },
  orange: { bg: "bg-orange-500", ring: "ring-orange-300", text: "text-orange-600" },
  red: { bg: "bg-rose-500", ring: "ring-rose-300", text: "text-rose-600" },
  teal: { bg: "bg-teal-500", ring: "ring-teal-300", text: "text-teal-600" },
};
export const colorOf = (key: string) => COLORS[key] ?? COLORS.grape;
