"use client";

import { AVATARS, COLORS, colorOf } from "@/lib/player";

export interface ProfileValues {
  name: string;
  avatar: string;
  color: string;
}

export function Avatar({ avatar, color, size = "md" }: { avatar: string; color: string; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-9 w-9 text-xl", md: "h-16 w-16 text-4xl", lg: "h-24 w-24 text-6xl" }[size];
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${colorOf(color).bg} ${dims}`}>{avatar}</span>;
}

/** Name, avatar and colour pickers, shared by "Add player" and "My profile". */
export default function ProfileFields({ value, onChange }: { value: ProfileValues; onChange: (v: ProfileValues) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Avatar avatar={value.avatar} color={value.color} size="lg" />
      </div>
      <label className="block">
        <span className="font-bold">Name</span>
        <input
          className="input mt-1 text-lg"
          maxLength={20}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Your name"
          autoFocus
        />
      </label>
      <div>
        <span className="font-bold">Avatar</span>
        <div className="mt-1 grid grid-cols-8 gap-2">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => onChange({ ...value, avatar: a })}
              className={`rounded-xl p-1 text-3xl transition hover:scale-110 ${value.avatar === a ? "bg-purple-100 ring-4 ring-grape" : ""}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="font-bold">Colour</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {Object.entries(COLORS).map(([key, c]) => (
            <button
              type="button"
              key={key}
              aria-label={key}
              onClick={() => onChange({ ...value, color: key })}
              className={`h-10 w-10 rounded-full ${c.bg} transition hover:scale-110 ${value.color === key ? `ring-4 ${c.ring} ring-offset-2` : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
