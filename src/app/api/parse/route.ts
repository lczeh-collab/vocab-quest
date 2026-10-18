import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const Body = z.object({
  image: z.string().min(100), // base64, no data: prefix
  mediaType: z.enum(MEDIA_TYPES),
});

const Extraction = z.object({
  pairs: z.array(
    z.object({
      en: z.string().describe("English word or expression, as written"),
      hu: z.string().describe("Hungarian meaning, as written"),
      kind: z.enum(["word", "expression"]),
      uncertain: z.boolean().describe("true if any part was hard to read"),
    }),
  ),
});

const PROMPT = `This is a photo of a 13-year-old Hungarian student's handwritten English vocabulary notebook.
Extract every English–Hungarian pair on the page.

- Usually English is on the left and Hungarian on the right, but follow the actual layout.
- kind = "expression" for multi-word phrases ("look forward to", "in the end"), otherwise "word".
- Keep each side as written, but fix obvious letter-level misreadings of handwriting and keep Hungarian accents (á, é, í, ó, ö, ő, ú, ü, ű).
- Keep short grammar hints that belong to the entry, e.g. "(sth)", "(irregular: went, gone)".
- Skip headings, dates, page numbers, doodles and crossed-out entries.
- Set uncertain=true when you had to guess any part, so the student can double-check it.
- If the photo contains no vocabulary, return an empty list.`;

const anthropic = new Anthropic();

export async function POST(request: Request) {
  // Only signed-in, allow-listed users may spend API credit.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!user || (allowed.length && !allowed.includes(user.email?.toLowerCase() ?? ""))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Please send a JPEG, PNG or WebP image." }, { status: 400 });

  // Server-side fallback re-runs a declined request on another model. Haiku has no fallback.
  const fallback = MODEL.includes("haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

  try {
    const response = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
      ...fallback,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: body.data.mediaType, data: body.data.image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read this photo. Try a sharper, well-lit one." }, { status: 422 });
    }
    const pairs = response.parsed_output.pairs
      .map((p) => ({ ...p, en: p.en.trim(), hu: p.hu.trim() }))
      .filter((p) => p.en && p.hu);
    return NextResponse.json({ pairs });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Too many photos at once, wait a minute and try again." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return NextResponse.json({ error: "The reading service had a problem. Try again." }, { status: 502 });
    }
    throw err;
  }
}
