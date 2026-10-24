import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { explainClaudeError } from "@/lib/claude-errors";
import { requireAllowedUser } from "@/lib/supabase/auth";

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
  const auth = await requireAllowedUser();
  if (auth instanceof NextResponse) return auth;

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Please send a JPEG, PNG or WebP image." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy." },
      { status: 500 },
    );
  }

  const callClaude = (withFallback: boolean) =>
    anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
      // Server-side fallback re-runs a declined request on another model.
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
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

  try {
    let response;
    try {
      // Haiku has no server-side fallback.
      response = await callClaude(!MODEL.includes("haiku"));
    } catch (err) {
      // If this account or model doesn't accept the fallback option, read the photo without it.
      if (err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message)) {
        console.warn("Retrying without fallback:", err.message);
        response = await callClaude(false);
      } else throw err;
    }

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read this photo. Try a sharper, well-lit one." }, { status: 422 });
    }
    const pairs = response.parsed_output.pairs
      .map((p) => ({ ...p, en: p.en.trim(), hu: p.hu.trim() }))
      .filter((p) => p.en && p.hu);
    return NextResponse.json({ pairs });
  } catch (err) {
    if (!(err instanceof Anthropic.APIError)) throw err;
    console.error("Anthropic API error", err.status, err.message);
    return NextResponse.json({ error: explainClaudeError(err, MODEL) }, { status: err instanceof Anthropic.RateLimitError ? 429 : 502 });
  }
}
