import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Flashcards was removed; send old bookmarks to the home screen.
  async redirects() {
    return [{ source: "/play/flashcards", destination: "/", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
