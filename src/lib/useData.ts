"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lazyClient } from "./supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlayerId } from "./player";
import { loadPlayer } from "./progress";
import type { Player, Word } from "./types";

export function useSupabase() {
  return useMemo(() => lazyClient(), []);
}

async function fetchWords(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("words")
    .select("*")
    .eq("player_id", getPlayerId())
    .order("created_at", { ascending: false });
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

export function usePlayer() {
  const supabase = useSupabase();
  const [profile, setProfile] = useState<Player | null>(null);
  useEffect(() => {
    loadPlayer(supabase).then(setProfile);
  }, [supabase]);
  return profile;
}
