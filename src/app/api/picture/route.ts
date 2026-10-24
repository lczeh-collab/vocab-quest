import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { explainClaudeError } from "@/lib/claude-errors";
import { requireAllowedUser } from "@/lib/supabase/auth";

// Image generation takes ~10-30 s.
export const maxDuration = 120;

const PLAN_MODEL = process.env.PICTURE_PLAN_MODEL || "claude-haiku-5-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
const IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "medium") as "low" | "medium" | "high";
const DAILY_LIMIT = Number(process.env.PICTURE_DAILY_LIMIT || 60);
const SIGNED_URL_SECONDS = 60 * 60;

const Body = z.object({ wordId: z.string().uuid(), renew: z.boolean().optional() });

const Plan = z.object({
  example: z
    .string()
    .nullable()
    .describe("Only for words that are hard to draw: a simple everyday English expression (3-8 words) using the word; otherwise null"),
  scene: z.string().describe("What the picture shows, 1-3 sentences, concrete and visual"),
  style: z.enum(["colourful illustration", "3D render", "realistic photo", "watercolour painting", "comic style"]),
});

function planPrompt(en: string, hu: string, kind: string, previousScene?: string) {
  return `You plan pictures for a vocabulary game. A 13-year-old Hungarian student learning English sees only the picture and has to type the English ${kind}.

English: "${en}"
Hungarian meaning: "${hu}" (use it to pick the right sense of the English)

- Describe one clear scene that shows exactly this meaning, so a 13-year-old could guess it. The key thing should be big and central, in its most typical form.
- If it is abstract or hard to draw (like "although", "honest", "look forward to"), set "example" to a simple everyday expression that uses it, like "She is looking forward to the holiday", and describe a scene that shows that expression.
- Choose the style that shows the meaning best. It should appeal to a 13-year-old, not look babyish.
- The picture must not contain any written text, letters, numbers or signs.
- Keep it age-appropriate: nothing violent, scary, romantic, no alcohol, no brands and no real people.${
    previousScene ? `\n- The student asked for a new picture. Show it clearly differently from the previous one: "${previousScene}"` : ""
  }`;
}

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const auth = await requireAllowedUser();
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    if (!process.env[key]) return fail(`${key} is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.`, 500);
  }

  // Created here, not at module load: the OpenAI client throws when its key is missing.
  const openai = new OpenAI();

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("Missing word.", 400);

  const { data: word } = await supabase.from("words").select("en, hu, kind").eq("id", body.data.wordId).maybeSingle();
  if (!word) return fail("Word not found.", 404);
  const enKey = word.en.trim().toLowerCase();

  const { data: existing } = await supabase.from("word_pictures").select("path, scene, example").eq("en_key", enKey).maybeSingle();
  if (existing && !body.data.renew) return NextResponse.json(await withUrl(existing));

  // Spending guard: at most DAILY_LIMIT new pictures per family per 24 hours.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("picture_log").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return fail(`That's ${DAILY_LIMIT} new pictures today, the daily limit. More tomorrow! 🌙`, 429);

  // 1. Claude decides what to draw.
  let plan: z.infer<typeof Plan>;
  try {
    const response = await anthropic.messages.parse({
      model: PLAN_MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(Plan) },
      messages: [{ role: "user", content: planPrompt(word.en, word.hu, word.kind, body.data.renew ? existing?.scene : undefined) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return fail("Couldn't plan a picture for this word.", 422);
    plan = response.parsed_output;
  } catch (err) {
    if (!(err instanceof Anthropic.APIError)) throw err;
    console.error("Anthropic API error", err.status, err.message);
    return fail(explainClaudeError(err, PLAN_MODEL), 502);
  }

  // 2. GPT draws it.
  let image: Buffer;
  try {
    const result = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: `${plan.style}, made for a 13-year-old's English vocabulary game. ${plan.scene} The picture must contain no text, letters, numbers or writing of any kind. Clear, bright, friendly and age-appropriate.`,
      size: "1024x1024",
      quality: IMAGE_QUALITY,
      output_format: "webp",
      output_compression: 75,
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return fail("The picture service returned no image. Try again.", 502);
    image = Buffer.from(b64, "base64");
  } catch (err) {
    if (!(err instanceof OpenAI.APIError)) throw err;
    console.error("OpenAI API error", err.status, err.code, err.message);
    return fail(explainOpenAIError(err), err.status === 429 ? 429 : 502);
  }

  // 3. Store the file, then point the word at it (and drop the old picture).
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const upload = await supabase.storage.from("pictures").upload(path, image, { contentType: "image/webp" });
  if (upload.error) return fail(`Couldn't save the picture: ${upload.error.message}`, 500);

  const saved = { en_key: enKey, path, scene: plan.scene, example: plan.example };
  const { error } = await supabase.from("word_pictures").upsert(saved, { onConflict: "user_id,en_key" });
  if (error) return fail(`Couldn't save the picture: ${error.message}`, 500);
  await supabase.from("picture_log").insert({});
  if (existing) await supabase.storage.from("pictures").remove([existing.path]);

  return NextResponse.json(await withUrl(saved));

  async function withUrl(p: { path: string; example: string | null }) {
    const { data } = await supabase.storage.from("pictures").createSignedUrl(p.path, SIGNED_URL_SECONDS);
    return { path: p.path, example: p.example, url: data?.signedUrl ?? null };
  }
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function explainOpenAIError(err: InstanceType<typeof OpenAI.APIError>): string {
  if (err.status === 401) return "The OpenAI API key is wrong or was revoked. Check OPENAI_API_KEY in Vercel, then redeploy.";
  if (err.code === "insufficient_quota" || /quota|billing/i.test(err.message))
    return "The OpenAI account has no credit left. Add credit at platform.openai.com → Billing.";
  if (err.status === 429) return "Making pictures too fast. Wait a minute and try again.";
  if (err.code === "moderation_blocked" || /safety|moderation/i.test(err.message))
    return "The picture service's safety filter blocked this one. Try “New picture”.";
  if (err.status === 403) return `OpenAI refused: ${err.message} (image models can require verifying your organization at platform.openai.com).`;
  return `The picture service had a problem: ${err.message}`;
}
