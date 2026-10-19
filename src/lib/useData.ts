"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lazyClient } from "./supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProfile } from "./progress";
import type { Profile, Word } from "./types";

export function useSupabase() {
  return useMemo(() => lazyClient(), []);
}

async function fetchWords(supabase: SupabaseClient) {
  const { data } = await supabase.from("words").select("*").order("created_at", { ascending: false });
  return (data as Word[]) ?? [];
}

export function useWords() {
  const supabase = useSupabase();
  const [words, setWords] = useState<Word[] | null>(null);
  const reload = useCallback(async () => setWords(await fetchWords(supabase)), [supabase]);
  useEffect(() => {
    let alive = true;
    fetchWords(supabase).then((w) => alive && setWords(w));
    return () => {
      alive = false;
    };
  }, [supabase]);
  return { words, reload, supabase };
}

export function useProfile() {
  const supabase = useSupabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    loadProfile(supabase).then(setProfile);
  }, [supabase]);
  return profile;
}
