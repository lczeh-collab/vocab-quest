"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { Word } from "./types";
import { useSupabase } from "./useData";

export interface Picture {
  url: string;
  example: string | null;
}

export const pictureKey = (en: string) => en.trim().toLowerCase();

/** All pictures of the family, keyed by lower-cased English word, with 1-hour private links. */
async function fetchPictures(supabase: SupabaseClient): Promise<Map<string, Picture>> {
  const { data } = await supabase.from("word_pictures").select("en_key, path, example");
  const rows = data ?? [];
  if (!rows.length) return new Map();
  const { data: signed } = await supabase.storage.from("pictures").createSignedUrls(
    rows.map((r) => r.path),
    60 * 60,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return new Map(
    rows.filter((r) => urlByPath.get(r.path)).map((r) => [r.en_key, { url: urlByPath.get(r.path)!, example: r.example }]),
  );
}

export function usePictures() {
  const supabase = useSupabase();
  const [pictures, setPictures] = useState<Map<string, Picture> | null>(null);
  useEffect(() => {
    let alive = true;
    fetchPictures(supabase).then((p) => alive && setPictures(p));
    return () => {
      alive = false;
    };
  }, [supabase]);
  const put = useCallback((en: string, picture: Picture) => {
    setPictures((prev) => new Map(prev ?? []).set(pictureKey(en), picture));
  }, []);
  return { pictures, put };
}

/** Asks the server to make (or with renew, remake) the picture for a word. Throws with a readable message. */
export async function requestPicture(wordId: string, renew = false): Promise<Picture> {
  const res = await fetch("/api/picture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, renew }),
  });
  const data = await res.json().catch(() => ({ error: "Something went wrong." }));
  if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong.");
  return { url: data.url, example: data.example };
}

/**
 * Makes pictures one at a time for words that have none yet (one at a time keeps
 * within the image service's rate limits). Stops at the first error.
 */
export async function makeMissingPictures(
  words: Pick<Word, "id" | "en">[],
  have: (en: string) => boolean,
  onDone: (word: Pick<Word, "id" | "en">, picture: Picture, index: number, total: number) => void,
  shouldStop: () => boolean = () => false,
) {
  // Siblings' words share pictures, so one per English word is enough.
  const todo = [...new Map(words.filter((w) => !have(w.en)).map((w) => [pictureKey(w.en), w])).values()];
  for (const [i, word] of todo.entries()) {
    if (shouldStop()) return;
    onDone(word, await requestPicture(word.id), i + 1, todo.length);
  }
}
