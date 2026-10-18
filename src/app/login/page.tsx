"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <div className="card mx-auto mt-10 max-w-md text-center">
      <div className="text-6xl">🦄</div>
      <h1 className="mt-2 text-3xl font-black">Welcome back!</h1>
      {state === "sent" ? (
        <p className="mt-4 text-lg">Check your email and click the magic link ✉️</p>
      ) : (
        <form onSubmit={send} className="mt-6 space-y-3">
          <input
            className="input text-center"
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary w-full" disabled={state === "sending"}>
            {state === "sending" ? "Sending..." : "Send me a magic link ✨"}
          </button>
          {state === "error" && <p className="text-bubble">Something went wrong. Try again?</p>}
        </form>
      )}
    </div>
  );
}
