import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "./server";

/**
 * For API routes that spend money on AI: only signed-in users whose email is in
 * ALLOWED_EMAILS (when set) get through. Returns a 401 response otherwise.
 */
export async function requireAllowedUser(): Promise<{ supabase: SupabaseClient; user: User } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!user || (allowed.length && !allowed.includes(user.email?.toLowerCase() ?? ""))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  return { supabase, user };
}
