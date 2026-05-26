/**
 * Parse a Response body as JSON, tolerating an empty or non-JSON body.
 *
 * Error responses (especially unhandled 500s) often have an empty body, so
 * `res.json()` throws "Unexpected end of JSON input". Callers that read error
 * payloads should use this instead of assuming the body is always JSON.
 */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}
