"use client";

import { useEffect, useState } from "react";
import PinPad from "@/components/PinPad";
import ProfileFields, { Avatar, type ProfileValues } from "@/components/ProfileFields";
import { AVATARS, colorOf, reloadTo, setPlayerId } from "@/lib/player";
import { useSupabase } from "@/lib/useData";
import type { Player } from "@/lib/types";

type Card = Pick<Player, "id" | "name" | "avatar" | "color">;
type Step = { kind: "pick" } | { kind: "pin"; player: Card } | { kind: "add" } | { kind: "newPin"; values: ProfileValues; first?: string };

export default function PlayersPage() {
  const supabase = useSupabase();
  const [players, setPlayers] = useState<Card[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [message, setMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<ProfileValues>({ name: "", avatar: AVATARS[0], color: "grape" });

  useEffect(() => {
    supabase
      .from("players")
      .select("id, name, avatar, color")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) setLoadError(error.message);
        else setPlayers(data as Card[]);
      });
  }, [supabase]);

  function go(step: Step) {
    setMessage(null);
    setStep(step);
  }

  function retry(msg: string) {
    setMessage(msg);
    setResetKey((k) => k + 1);
  }

  function enter(id: string) {
    setPlayerId(id);
    reloadTo("/");
  }

  async function checkPin(player: Card, pin: string) {
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_pin", { p_player: player.id, p_pin: pin });
    setBusy(false);
    if (error) return retry(error.message);
    if (data.ok) return enter(player.id);
    if (data.locked_seconds) return retry(`Too many tries. Wait ${data.locked_seconds} seconds ⏳`);
    retry(`Wrong PIN. ${data.tries_left} ${data.tries_left === 1 ? "try" : "tries"} left`);
  }

  async function createPlayer(v: ProfileValues, pin: string) {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_player", { p_name: v.name.trim(), p_pin: pin, p_avatar: v.avatar, p_color: v.color });
    setBusy(false);
    if (error) {
      if (error.code === "23505") {
        setStep({ kind: "add" });
        return setMessage(`"${v.name.trim()}" is already taken. Pick another name.`);
      }
      return retry(error.message);
    }
    enter(data as string);
  }

  if (loadError)
    return (
      <div className="card mx-auto max-w-lg text-center">
        <p className="text-xl font-black">⚠️ Player profiles aren&apos;t set up yet</p>
        <p className="mt-2">
          Run <code className="rounded bg-purple-50 px-1">supabase/002_players.sql</code> in the Supabase SQL Editor, then reload this page.
        </p>
        <p className="mt-2 text-sm text-purple-400">{loadError}</p>
      </div>
    );
  if (!players) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;

  if (step.kind === "pin") {
    const c = colorOf(step.player.color);
    return (
      <div className="card mx-auto max-w-sm">
        <div className="mb-2 flex flex-col items-center gap-2">
          <Avatar avatar={step.player.avatar} color={step.player.color} size="lg" />
          <p className={`text-2xl font-black ${c.text}`}>Hi {step.player.name}!</p>
        </div>
        <PinPad title="Enter your PIN" message={message} resetKey={resetKey} disabled={busy} onComplete={(pin) => checkPin(step.player, pin)} />
        <BackButton onClick={() => go({ kind: "pick" })} />
      </div>
    );
  }

  if (step.kind === "add") {
    const name = values.name.trim();
    return (
      <div className="card mx-auto max-w-md">
        <h1 className="mb-4 text-center text-2xl font-black">✨ New player</h1>
        <ProfileFields value={values} onChange={setValues} />
        {message && <p className="mt-3 text-center font-bold text-bubble">{message}</p>}
        <button className="btn-primary mt-5 w-full" disabled={!name} onClick={() => go({ kind: "newPin", values })}>
          Next: choose a PIN →
        </button>
        <BackButton onClick={() => go({ kind: "pick" })} />
      </div>
    );
  }

  if (step.kind === "newPin") {
    const confirming = step.first !== undefined;
    return (
      <div className="card mx-auto max-w-sm">
        <div className="mb-2 flex justify-center">
          <Avatar avatar={step.values.avatar} color={step.values.color} size="lg" />
        </div>
        <PinPad
          key={confirming ? "confirm" : "first"}
          title={confirming ? "Type it again to confirm" : `Choose a 4-digit PIN, ${step.values.name.trim()}`}
          message={message}
          resetKey={resetKey}
          disabled={busy}
          onComplete={(pin) => {
            if (!confirming) return go({ ...step, first: pin });
            if (pin !== step.first) {
              setStep({ kind: "newPin", values: step.values });
              return retry("The PINs didn't match. Try again.");
            }
            createPlayer(step.values, pin);
          }}
        />
        <p className="mt-3 text-center text-sm text-purple-400">Remember it! You&apos;ll need it every time you play.</p>
        <BackButton onClick={() => go({ kind: "add" })} />
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-4xl font-black">Who&apos;s playing? 🎮</h1>
      {players.length === 0 && (
        <p className="mt-2">Create the first player. They&apos;ll keep all the words and points collected so far.</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-6">
        {players.map((p) => (
          <button key={p.id} onClick={() => go({ kind: "pin", player: p })} className="group flex w-36 flex-col items-center gap-2">
            <span className="rounded-full p-1 ring-4 ring-transparent transition group-hover:scale-105 group-hover:ring-purple-200">
              <Avatar avatar={p.avatar} color={p.color} size="lg" />
            </span>
            <span className="max-w-full truncate text-xl font-black">{p.name}</span>
          </button>
        ))}
        <button
          onClick={() => {
            setValues({ name: "", avatar: AVATARS[players.length % AVATARS.length], color: "grape" });
            go({ kind: "add" });
          }}
          className="group flex w-36 flex-col items-center gap-2"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-purple-300 text-5xl text-purple-300 transition group-hover:scale-105 group-hover:border-grape group-hover:text-grape">
            +
          </span>
          <span className="text-xl font-black text-purple-400">Add player</span>
        </button>
      </div>
      <button
        className="mt-12 text-sm text-purple-400 underline"
        onClick={async () => {
          await supabase.auth.signOut();
          reloadTo("/login");
        }}
      >
        Log out of the family account
      </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="mx-auto mt-4 block text-sm font-bold text-purple-400 hover:text-grape" onClick={onClick}>
      ← Back
    </button>
  );
}
