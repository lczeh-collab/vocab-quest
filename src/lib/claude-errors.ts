import Anthropic from "@anthropic-ai/sdk";

/** Turns an API failure into a message that says what to fix. */
export function explainClaudeError(err: InstanceType<typeof Anthropic.APIError>, model: string): string {
  if (err instanceof Anthropic.AuthenticationError)
    return "The Anthropic API key is wrong or was revoked. Check ANTHROPIC_API_KEY in Vercel (no spaces or quotes), then redeploy.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This Anthropic API key isn't allowed to use this model.";
  if (err instanceof Anthropic.NotFoundError) return `The model "${model}" isn't available for this API key. Check the model setting in Vercel.`;
  if (err instanceof Anthropic.RateLimitError) return "Too many requests at once. Wait a minute and try again.";
  if (/credit balance/i.test(err.message))
    return "The Anthropic account has no credit left. Add credit at console.anthropic.com → Billing.";
  if (err instanceof Anthropic.BadRequestError) return `The reading service rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the reading service. Check the internet connection and try again.";
  return "The reading service is busy right now. Try again in a minute.";
}
