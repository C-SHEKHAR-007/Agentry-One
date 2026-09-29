/** Turns a raw job failure message into a plain explanation and, where there
 * is one, the place to fix it. Unknown errors get a generic hint; the raw
 * message is always shown too. */
export interface FailureHint {
  title: string;
  advice: string;
  action?: { label: string; to: string };
}

const RULES: Array<{ test: RegExp; hint: FailureHint }> = [
  {
    test: /SD-Turbo needs torch|torch \+ diffusers/i,
    hint: {
      title: "No image model is available",
      advice: "The worker doesn't have the local image model installed. Configure a hosted image provider, or install the local model on the worker.",
      action: { label: "Open AI Providers", to: "/providers" },
    },
  },
  {
    test: /no provider configured for required capability|no active provider/i,
    hint: {
      title: "No AI provider is set up for this step",
      advice: "This agent needs a provider (for example an image or text model) and none is configured as the default.",
      action: { label: "Open AI Providers", to: "/providers" },
    },
  },
  // Specific messages first: the worker-credential error also carries an HTTP 403.
  {
    test: /could not fetch job credentials|AGENTRY_API_KEY must be set/i,
    hint: { title: "The worker couldn't reach the API", advice: "The worker needs AGENTRY_API_KEY and AGENTRY_API_URL to fetch this job's credentials. Check the worker's configuration." },
  },
  {
    test: /\b(401|403)\b|unauthori[sz]ed|invalid api key|incorrect api key|forbidden/i,
    hint: {
      title: "The provider rejected the credentials",
      advice: "The API key for this provider looks invalid, expired, or missing permissions. Re-enter it on the provider.",
      action: { label: "Open AI Providers", to: "/providers" },
    },
  },
  {
    test: /\b429\b|rate limit|quota/i,
    hint: { title: "The provider is rate-limiting requests", advice: "You've hit the provider's rate limit or quota. Wait a bit and run it again, or raise the limit with the provider." },
  },
  {
    test: /exceeded its \d+s timeout|timed out|timeout/i,
    hint: { title: "The step took too long", advice: "It ran past its time limit. Try smaller inputs (fewer steps, shorter duration) or run it again." },
  },
  {
    test: /social account .* (no longer|not) (available|connected)|disconnected or expired/i,
    hint: {
      title: "The social account isn't available",
      advice: "It was disconnected or its token expired. Reconnect it and run again.",
      action: { label: "Open Integrations", to: "/integrations" },
    },
  },
  {
    test: /not an artifact reference|must be an http\(s\) URL or an artifact reference|non-public address/i,
    hint: { title: "An input pointed somewhere it isn't allowed to", advice: "File inputs must come from an earlier step's output, and URLs must be public http(s) addresses." },
  },
];

export function failureHint(message: string | null | undefined): FailureHint {
  const m = message ?? "";
  for (const r of RULES) if (r.test.test(m)) return r.hint;
  return { title: "The agent reported an error", advice: "The details below come straight from the agent. Running it again often helps with temporary problems." };
}

/** The message stored on a failed attempt ({ message } JSON), if any. */
export function attemptError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) return String((error as { message: unknown }).message ?? "") || null;
  return null;
}
