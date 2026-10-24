"use client";

import { useRef, useState } from "react";
import { makeMissingPictures, pictureKey, requestPicture, usePictures, type Picture } from "@/lib/pictures";
import { getPlayerId } from "@/lib/player";
import type { Word } from "@/lib/types";
import { useWords } from "@/lib/useData";

const BOX_LABEL = ["", "🌱 new", "🌿 learning", "🌳 growing", "⭐ strong", "🧠 mastered"];

export default function WordsPage() {
  const { words, reload, supabase } = useWords();
  const { pictures, put } = usePictures();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ en: "", hu: "" });
  const [adding, setAdding] = useState({ en: "", hu: "" });
  // English words whose picture is being made right now
  const [making, setMaking] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const stopBulk = useRef(false);
  const [viewing, setViewing] = useState<Word | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);

  if (!words || !pictures) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;

  const q = query.trim().toLowerCase();
  const shown = words.filter((w) => !q || w.en.toLowerCase().includes(q) || w.hu.toLowerCase().includes(q));
  const pictureOf = (w: Pick<Word, "en">) => pictures.get(pictureKey(w.en));
  const missing = words.filter((w) => !pictureOf(w)).length;

  function setBusy(en: string, busy: boolean) {
    setMaking((prev) => {
      const next = new Set(prev);
      if (busy) next.add(pictureKey(en));
      else next.delete(pictureKey(en));
      return next;
    });
  }

  async function makePicture(w: Pick<Word, "id" | "en">, renew = false) {
    setPictureError(null);
    setBusy(w.en, true);
    try {
      put(w.en, await requestPicture(w.id, renew));
    } catch (err) {
      setPictureError((err as Error).message);
    } finally {
      setBusy(w.en, false);
    }
  }

  async function makeAllMissing() {
    setPictureError(null);
    stopBulk.current = false;
    setBulk({ done: 0, total: missing });
    try {
      await makeMissingPictures(
        words!,
        (en) => !!pictureOf({ en }),
        (word, picture, done, total) => {
          put(word.en, picture);
          setBulk({ done, total });
        },
        () => stopBulk.current,
      );
    } catch (err) {
      setPictureError((err as Error).message);
    }
    setBulk(null);
  }

  async function saveEdit(w: Word) {
    await supabase.from("words").update({ en: draft.en.trim(), hu: draft.hu.trim() }).eq("id", w.id);
    setEditing(null);
    reload();
  }

  async function remove(w: Word) {
    if (!confirm(`Delete "${w.en}"?`)) return;
    await supabase.from("words").delete().eq("id", w.id);
    reload();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const en = adding.en.trim();
    const hu = adding.hu.trim();
    if (!en || !hu) return;
    const { data, error } = await supabase
      .from("words")
      .insert({ player_id: getPlayerId(), en, hu, kind: en.includes(" ") ? "expression" : "word" })
      .select("id, en")
      .single();
    if (error) return alert(error.code === "23505" ? `"${en}" is already in your list.` : error.message);
    setAdding({ en: "", hu: "" });
    reload();
    if (!pictureOf(data)) makePicture(data);
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-black">📚 My words ({words.length})</h1>
        <input className="input max-w-xs" placeholder="🔍 Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <form onSubmit={add} className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input className="input" placeholder="English" value={adding.en} onChange={(e) => setAdding({ ...adding, en: e.target.value })} />
        <input className="input" placeholder="Magyar" value={adding.hu} onChange={(e) => setAdding({ ...adding, hu: e.target.value })} />
        <button className="btn-primary">➕</button>
      </form>

      {(missing > 0 || bulk) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-purple-50 p-3">
          {bulk ? (
            <>
              <span className="animate-pulse font-bold">
                🎨 Making pictures… {bulk.done} / {bulk.total}
              </span>
              <button className="btn-ghost px-3 py-1 text-sm" onClick={() => (stopBulk.current = true)}>
                Stop
              </button>
            </>
          ) : (
            <>
              <span className="font-bold">
                {missing} word{missing === 1 ? "" : "s"} without a picture
              </span>
              <button className="btn-primary px-4 py-2 text-sm" onClick={makeAllMissing} disabled={making.size > 0}>
                🎨 Make pictures
              </button>
            </>
          )}
        </div>
      )}
      {pictureError && <p className="rounded-xl bg-pink-50 p-3 text-center font-bold text-bubble">{pictureError}</p>}

      <ul className="divide-y divide-purple-100">
        {shown.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-2 py-2">
            {editing === w.id ? (
              <>
                <input className="input flex-1" value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
                <input className="input flex-1" value={draft.hu} onChange={(e) => setDraft({ ...draft, hu: e.target.value })} />
                <button className="btn-primary px-3 py-2" onClick={() => saveEdit(w)}>
                  ✔️
                </button>
                <button className="btn-ghost px-3 py-2" onClick={() => setEditing(null)}>
                  ✖️
                </button>
              </>
            ) : (
              <>
                <Thumbnail
                  picture={pictureOf(w)}
                  busy={making.has(pictureKey(w.en))}
                  onOpen={() => setViewing(w)}
                  onMake={() => makePicture(w)}
                  disabled={!!bulk}
                />
                <span className="flex-1 font-bold">{w.en}</span>
                <span className="flex-1">{w.hu}</span>
                <span className="w-28 text-xs font-bold text-purple-400">{BOX_LABEL[w.box]}</span>
                <button
                  className="rounded-lg px-2 hover:bg-purple-50"
                  aria-label="Edit"
                  onClick={() => {
                    setEditing(w.id);
                    setDraft({ en: w.en, hu: w.hu });
                  }}
                >
                  ✏️
                </button>
                <button className="rounded-lg px-2 hover:bg-pink-50" aria-label="Delete" onClick={() => remove(w)}>
                  🗑️
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-center text-purple-400">No words here yet.</p>}

      {viewing && pictureOf(viewing) && (
        <PictureViewer
          word={viewing}
          picture={pictureOf(viewing)!}
          busy={making.has(pictureKey(viewing.en))}
          error={pictureError}
          onRenew={() => makePicture(viewing, true)}
          onClose={() => {
            setViewing(null);
            setPictureError(null);
          }}
        />
      )}
    </div>
  );
}

function Thumbnail({
  picture,
  busy,
  onOpen,
  onMake,
  disabled,
}: {
  picture?: Picture;
  busy: boolean;
  onOpen: () => void;
  onMake: () => void;
  disabled: boolean;
}) {
  const box = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl";
  if (busy) return <span className={`${box} animate-pulse bg-purple-100 text-2xl`}>🎨</span>;
  if (picture)
    return (
      <button className={`${box} ring-2 ring-purple-100 transition hover:scale-110`} onClick={onOpen} aria-label="Show picture">
        {/* Signed Supabase URLs expire, so Next's image optimizer would only cache dead links. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture.url} alt="" className="h-full w-full object-cover" />
      </button>
    );
  return (
    <button
      className={`${box} border-2 border-dashed border-purple-200 text-xl text-purple-300 hover:border-grape hover:text-grape`}
      onClick={onMake}
      disabled={disabled}
      title="Make a picture"
    >
      🎨
    </button>
  );
}

function PictureViewer({
  word,
  picture,
  busy,
  error,
  onRenew,
  onClose,
}: {
  word: Word;
  picture: Picture;
  busy: boolean;
  error: string | null;
  onRenew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md text-center animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture.url} alt={word.en} className={`aspect-square w-full object-cover ${busy ? "opacity-40 blur-sm" : ""}`} />
          {busy && <span className="absolute inset-0 flex items-center justify-center text-xl font-black">🎨 Painting a new one…</span>}
        </div>
        <p className="mt-3 text-2xl font-black">{word.en}</p>
        <p className="text-purple-500">{word.hu}</p>
        {picture.example && <p className="mt-2 rounded-xl bg-purple-50 p-2 italic">“{picture.example}”</p>}
        {error && <p className="mt-2 font-bold text-bubble">{error}</p>}
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-primary" onClick={onRenew} disabled={busy}>
            🔄 New picture
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
