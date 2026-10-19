import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  return (client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ));
}

/**
 * A handle that creates the real client on first use. Pages are prerendered at
 * build time, where only rendering happens (no effects or clicks), so the build
 * never needs the Supabase settings.
 */
export function lazyClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get: (_, prop) => {
      const real = createClient();
      const value = Reflect.get(real, prop);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}
