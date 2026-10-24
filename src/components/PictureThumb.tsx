"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Picture } from "@/lib/pictures";

const PREVIEW = 224;
const GAP = 12;

/**
 * Square picture as tall as its container; hovering shows it big on the given side.
 * Without a picture it leaves an empty space of the same size, so words stay lined up.
 */
export default function PictureThumb({ picture, previewSide = "right" }: { picture?: Picture; previewSide?: "left" | "right" }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  if (!picture) return <span className="aspect-square h-full shrink-0" />;

  // The big picture is drawn on top of the whole page (not inside the tile), so
  // neighbouring tiles and flipped 3D cards can never cover it.
  const left = rect && (previewSide === "right" ? rect.right + GAP : rect.left - GAP - PREVIEW);
  const top = rect && Math.min(Math.max(8, rect.top + rect.height / 2 - PREVIEW / 2), window.innerHeight - PREVIEW - 8);

  return (
    <span
      className="h-full shrink-0"
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {/* Pictures need the login cookie, which Next's image optimizer doesn't send. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={picture.url} alt="" className="aspect-square h-full rounded-xl object-cover" />
      {rect &&
        createPortal(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture.url}
            alt=""
            className="pointer-events-none fixed z-50 max-w-none rounded-2xl object-cover shadow-2xl ring-4 ring-white"
            style={{ left: left!, top: top!, width: PREVIEW, height: PREVIEW }}
          />,
          document.body,
        )}
    </span>
  );
}
