"use client";

import { useState } from "react";
import PinPad from "@/components/PinPad";
import ProfileFields, { type ProfileValues } from "@/components/ProfileFields";
import { getPlayerId } from "@/lib/player";
import { usePlayer, useSupabase } from "@/lib/useData";
import type { Player } from "@/lib/types";

export default function MePage() {
  const player = usePlayer();
  if (!player) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;
  return (
    <div className="mx-auto max-w-md space-y-6">
      <EditProfile player={player} />
      <ChangePin />
    </div>
  );
}

function EditProfile({ player }: { player: Player }) {
  const supabase = useSupabase();
  const [values, setValues] = useState<ProfileValues>({ name: player.name, avatar: player.avatar, color: player.color });
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    const { error } = await supabase
      .from("players")
      .update({ name: values.name.trim(), avatar: values.avatar, color: values.color })
      .eq("id", getPlayerId());
    if (error) return setStatus(error.code === "23505" ? "That name is already taken." : error.message);
    // Reload so the header shows the new name and avatar straight away.
    location.reload();
  }

  return (
    <section className="card">
      <h1 className="mb-4 text-2xl font-black">✏️ My profile</h1>
      <ProfileFields value={values} onChange={setValues} />
      {status && <p className="mt-3 font-bold text-bubble">{status}</p>}
      <button className="btn-primary mt-5 w-full" disabled={!values.name.trim()} onClick={save}>
        💾 Save
      </button>
    </section>
  );
}

function ChangePin() {
  const supabase = useSupabase();
  const [stage, setStage] = useState<"closed" | "old" | "new" | "confirm" | "done">("closed");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function confirm(pin: string) {
    if (pin !== newPin) {
      setMessage("The PINs didn't match. Choose the new PIN again.");
      setResetKey((k) => k + 1);
      return setStage("new");
    }
    const { data, error } = await supabase.rpc("change_pin", { p_player: getPlayerId(), p_old: oldPin, p_new: pin });
    if (error || !data) {
      setMessage(error?.message ?? "Your current PIN was wrong. Start again.");
      setResetKey((k) => k + 1);
      return setStage("old");
    }
    setStage("done");
  }

  if (stage === "closed" || stage === "done")
    return (
      <section className="card text-center">
        {stage === "done" && <p className="mb-3 text-lg font-black text-mint">✅ Your PIN was changed!</p>}
        <button className="btn-ghost" onClick={() => setStage("old")}>
          🔑 Change my PIN
        </button>
      </section>
    );

  const titles = { old: "Your current PIN", new: "Choose a new PIN", confirm: "Type the new PIN again" };
  return (
    <section className="card">
      <PinPad
        key={stage}
        title={titles[stage]}
        message={message}
        resetKey={resetKey}
        onComplete={(pin) => {
          setMessage(null);
          if (stage === "old") {
            setOldPin(pin);
            setStage("new");
          } else if (stage === "new") {
            setNewPin(pin);
            setStage("confirm");
          } else confirm(pin);
        }}
      />
      <button className="mx-auto mt-4 block text-sm font-bold text-purple-400" onClick={() => setStage("closed")}>
        Cancel
      </button>
    </section>
  );
}
