"use client";

import { useState } from "react";
import { getPlayerId } from "@/lib/player";
import type { Word } from "@/lib/types";
import { useWords } from "@/lib/useData";

const BOX_LABEL = ["", "🌱 new", "🌿 learning", "🌳 growing", "⭐ strong", "🧠 mastered"];

export default function WordsPage() {
  const { words, reload, supabase } = useWords();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ en: "", hu: "" });
  const [adding, setAdding] = useState({ en: "", hu: "" });

  if (!words) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;

  const q = query.trim().toLowerCase();
  const shown = words.filter((w) => !q || w.en.toLowerCase().includes(q) || w.hu.toLowerCase().includes(q));

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
    const { error } = await supabase.from("words").insert({ player_id: getPlayerId(), en, hu, kind: en.includes(" ") ? "expression" : "word" });
    if (error) return alert(error.code === "23505" ? `"${en}" is already in your list.` : error.message);
    setAdding({ en: "", hu: "" });
    reload();
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
    </div>
  );
}
