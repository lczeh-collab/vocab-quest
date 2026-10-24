"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toJpegBase64 } from "@/lib/image";
import { BADGES } from "@/lib/gamification";
import { makeMissingPictures, pictureKey, usePictures } from "@/lib/pictures";
import { getPlayerId } from "@/lib/player";
import { awardBadge } from "@/lib/progress";
import type { Kind, ParsedPair } from "@/lib/types";
import { useWords } from "@/lib/useData";

type Row = ParsedPair & { keep: boolean };

export default function ScanPage() {
  const { words, reload, supabase } = useWords();
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [newBadge, setNewBadge] = useState(false);
  const { pictures, put } = usePictures();
  const [pictureStatus, setPictureStatus] = useState<string | null>(null);

  async function parse(images: string[]) {
    setError(null);
    setSaved(null);
    for (const [i, image] of images.entries()) {
      setBusy(images.length > 1 ? `Reading photo ${i + 1} of ${images.length}... 🔍` : "Reading your handwriting... 🔍");
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong." }));
      if (!res.ok) {
        setError(data.error);
        continue;
      }
      setRows((prev) => [...prev, ...data.pairs.map((p: ParsedPair) => ({ ...p, keep: true }))]);
    }
    setBusy(null);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy("Preparing photos...");
    parse(await Promise.all([...files].map((f) => toJpegBase64(f))));
  }

  const existing = new Map((words ?? []).map((w) => [w.en.trim().toLowerCase(), w]));
  const statusOf = (r: Row) => {
    const w = existing.get(r.en.trim().toLowerCase());
    if (!w) return "new";
    return w.hu.trim() === r.hu.trim() ? "same" : "update";
  };

  async function save() {
    setBusy("Saving...");
    // Last occurrence wins if the same English word appears twice in the scan.
    const unique = new Map(rows.filter((r) => r.keep && r.en.trim() && r.hu.trim()).map((r) => [r.en.trim().toLowerCase(), r]));
    const fresh = [...unique.values()].filter((r) => statusOf(r) === "new");
    const changed = [...unique.values()].filter((r) => statusOf(r) === "update");

    const inserted = fresh.length
      ? await supabase
          .from("words")
          .insert(fresh.map(({ en, hu, kind }) => ({ player_id: getPlayerId(), en: en.trim(), hu: hu.trim(), kind })))
          .select("id, en")
      : { data: [], error: null };
    if (inserted.error) {
      setBusy(null);
      return setError(inserted.error.message);
    }
    const ops = [];
    for (const r of changed) {
      // A changed meaning is new learning again, so it goes back to box 1.
      const id = existing.get(r.en.trim().toLowerCase())!.id;
      ops.push(supabase.from("words").update({ hu: r.hu.trim(), kind: r.kind, box: 1, due_at: new Date().toISOString() }).eq("id", id));
    }
    const results = await Promise.all(ops);
    const failed = results.find((r) => r.error);
    setBusy(null);
    if (failed) return setError(failed.error!.message);
    setSaved(fresh.length + changed.length);
    setNewBadge(fresh.length + changed.length > 0 && (await awardBadge(supabase, "snapshot")));
    setRows([]);
    reload();
    makePictures(inserted.data ?? []);
  }

  // Pictures for the new words are made in the background while she can already play.
  async function makePictures(newWords: { id: string; en: string }[]) {
    const have = (en: string) => !!pictures?.has(pictureKey(en));
    if (!newWords.some((w) => !have(w.en))) return;
    setPictureStatus("🎨 Making pictures for your new words…");
    try {
      await makeMissingPictures(newWords, have, (w, picture, done, total) => {
        put(w.en, picture);
        setPictureStatus(done === total ? "🖼️ All pictures are ready!" : `🎨 Making pictures… ${done} / ${total}`);
      });
    } catch (err) {
      setPictureStatus(`Some pictures couldn't be made: ${(err as Error).message} You can try again on the Words page.`);
    }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-3xl font-black">📸 Scan your notebook</h1>
        <p className="mt-1">Good light, page flat, words in focus = best results.</p>

        <div className="mt-4 flex gap-2">
          <button className={mode === "upload" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("upload")}>
            🖼️ Upload photo
          </button>
          <button className={mode === "camera" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("camera")}>
            📷 Use webcam
          </button>
        </div>

        <div className="mt-4">
          {mode === "upload" ? (
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-4 border-dashed border-purple-200 p-10 text-center hover:bg-purple-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFiles(e.dataTransfer.files);
              }}
            >
              <span className="text-5xl">⬆️</span>
              <span className="mt-2 font-bold">Drop photos here or click to choose</span>
              <span className="text-sm text-purple-400">You can pick several pages at once</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
          ) : (
            <Webcam onCapture={(img) => parse([img])} />
          )}
        </div>

        {busy && <p className="mt-4 animate-pulse text-center text-lg font-bold">{busy}</p>}
        {error && <p className="mt-4 rounded-xl bg-pink-50 p-3 text-center font-bold text-bubble">{error}</p>}
        {saved !== null && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center animate-pop">
            <p className="text-xl font-black text-mint">🎉 {saved} words saved!</p>
            {newBadge && (
              <p className="mt-2 text-lg font-black animate-pop">
                {BADGES.find((b) => b.id === "snapshot")!.emoji} New badge: Snapshot!
              </p>
            )}
            {pictureStatus && <p className="mt-2 font-bold text-grape">{pictureStatus}</p>}
            <Link href="/" className="btn-primary mt-3">
              Let&apos;s play!
            </Link>
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="card">
          <h2 className="text-2xl font-black">Check the words ✏️</h2>
          <p className="text-sm">Fix anything that was misread. Yellow rows were hard to read.</p>
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => {
              const status = statusOf(r);
              return (
                <div
                  key={i}
                  className={`grid grid-cols-[auto_1fr_1fr] items-center gap-2 rounded-2xl p-2 sm:grid-cols-[auto_1fr_1fr_auto_auto] ${
                    r.uncertain ? "bg-yellow-50 ring-2 ring-sun" : "bg-purple-50/50"
                  } ${r.keep ? "" : "opacity-40"}`}
                >
                  <input type="checkbox" className="h-5 w-5 accent-grape" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} />
                  <input className="input" value={r.en} onChange={(e) => update(i, { en: e.target.value })} aria-label="English" />
                  <input className="input" value={r.hu} onChange={(e) => update(i, { hu: e.target.value })} aria-label="Hungarian" />
                  <select className="input col-start-2 sm:col-start-auto" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as Kind })}>
                    <option value="word">word</option>
                    <option value="expression">expression</option>
                  </select>
                  <span
                    className={`rounded-full px-2 py-1 text-center text-xs font-bold ${
                      { new: "bg-emerald-100 text-emerald-700", update: "bg-sky-100 text-sky-700", same: "bg-gray-100 text-gray-500" }[status]
                    }`}
                  >
                    {{ new: "NEW", update: "UPDATE", same: "ALREADY IN" }[status]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={save} disabled={!!busy}>
              💾 Save {rows.filter((r) => r.keep && statusOf(r) !== "same").length} words
            </button>
            <button className="btn-ghost" onClick={() => setRows((p) => [...p, { en: "", hu: "", kind: "word", uncertain: false, keep: true }])}>
              ➕ Add a row
            </button>
            <button className="btn-ghost" onClick={() => setRows([])}>
              🗑️ Discard
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Webcam({ onCapture }: { onCapture: (base64: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Can't open the camera. Allow camera access in the browser, or upload a photo instead."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function snap() {
    const v = video.current!;
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth * scale;
    canvas.height = v.videoHeight * scale;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    onCapture(await toJpegBase64(canvas));
  }

  if (error) return <p className="rounded-xl bg-pink-50 p-4 text-center font-bold text-bubble">{error}</p>;
  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={video} autoPlay playsInline muted className="w-full max-w-2xl rounded-3xl bg-black" />
      <button className="btn-primary text-lg" onClick={snap}>
        📸 Snap!
      </button>
      <p className="text-sm text-purple-400">Hold the notebook page up to the camera so the words fill the picture.</p>
    </div>
  );
}
