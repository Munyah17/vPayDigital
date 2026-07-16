// =============================================================================
// Shared HTTP helpers for IBAN provider clients
// =============================================================================

/**
 * Parses a fetch Response body as JSON, falling back to the raw text (or a
 * generic message) if the body isn't valid JSON — e.g. an upstream proxy
 * returning an HTML 502 page instead of the provider's usual JSON error
 * shape. Without this, `.json()` on a non-JSON error response throws from
 * inside the caller's own error-construction path, producing a confusing
 * "Unexpected token '<'..." error instead of the actual HTTP failure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}
