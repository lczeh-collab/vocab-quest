"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearPlayerId, reloadTo } from "@/lib/player";
import { loadPlayer } from "@/lib/progress";
import { lazyClient } from "@/lib/supabase/client";
import type { Player } from "@/lib/types";
import { Avatar } from "./ProfileFields";

/** Avatar + name of whoever is playing, on every page, with a "Switch" button. */
export default function PlayerBadge() {
  const path = usePathname();
  const hidden = path.startsWith("/login") || path.startsWith("/players");
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!hidden) loadPlayer(lazyClient()).then(setPlayer);
    // The name can change on the profile page, so reload on every navigation.
  }, [hidden, path]);

  if (hidden || !player) return null;

  function switchPlayer() {
    clearPlayerId();
    reloadTo("/players");
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/me" className="flex items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 shadow-sm ring-1 ring-purple-100 hover:bg-white">
        <Avatar avatar={player.avatar} color={player.color} size="sm" />
        <span className="max-w-32 truncate font-black">{player.name}</span>
      </Link>
      <button onClick={switchPlayer} className="rounded-full px-2 py-1 text-sm font-bold text-purple-400 hover:bg-white/70 hover:text-grape">
        🔄 Switch
      </button>
    </div>
  );
}
