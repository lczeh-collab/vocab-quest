"use client";

import { useEffect, useState } from "react";

interface Props {
  title: string;
  onComplete: (pin: string) => void;
  /** Shown under the dots, e.g. "Wrong PIN, 3 tries left". */
  message?: string | null;
  /** Changing this value clears the dots (e.g. after a wrong PIN). */
  resetKey?: number;
  disabled?: boolean;
}

/** 4-digit PIN entry: click the number pad or type on the keyboard. */
export default function PinPad({ title, onComplete, message, resetKey = 0, disabled }: Props) {
  const [digits, setDigits] = useState("");
  const [lastReset, setLastReset] = useState(resetKey);
  // Clear the dots when the parent asks for a retry (render-time reset, no effect needed).
  if (resetKey !== lastReset) {
    setLastReset(resetKey);
    setDigits("");
  }

  function press(d: string) {
    if (disabled || digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) onComplete(next);
  }
  const back = () => setDigits((s) => s.slice(0, -1));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="text-center">
      <p className="text-xl font-black">{title}</p>
      <div className={`my-4 flex justify-center gap-3 ${message && digits === "" ? "animate-shake" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-4 border-grape ${i < digits.length ? "bg-grape" : "bg-white"}`} />
        ))}
      </div>
      <p className="h-6 font-bold text-bubble">{message}</p>
      <div className="mx-auto mt-2 grid w-64 grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PadButton key={d} onClick={() => press(d)} disabled={disabled}>
            {d}
          </PadButton>
        ))}
        <span />
        <PadButton onClick={() => press("0")} disabled={disabled}>
          0
        </PadButton>
        <PadButton onClick={back} disabled={disabled} label="Delete">
          ⌫
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-16 rounded-2xl bg-white text-2xl font-black shadow ring-2 ring-purple-100 transition hover:bg-purple-50 active:scale-90 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
