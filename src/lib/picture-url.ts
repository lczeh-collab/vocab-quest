/**
 * Where the browser loads a word's picture from. The version (creation time) changes
 * with every new picture, so the long browser cache never shows an old one.
 */
export function pictureUrl(enKey: string, createdAt: string) {
  return `/api/picture?key=${encodeURIComponent(enKey)}&v=${Date.parse(createdAt)}`;
}
