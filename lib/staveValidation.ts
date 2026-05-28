export const ALLOWED_LICENSES = ["CC BY 4.0", "CC0", "MIT", "ARR"] as const;
export type License = (typeof ALLOWED_LICENSES)[number];

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_BODY_BYTES = 1_048_576;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 32;

export type StaveFields = {
  title: string;
  body: string;
  description: string | null;
  tags: string[];
  license: License;
};

/** Validates the size/shape rules that the DB CHECKs can't fully express. */
export function validateStaveFields(input: {
  title?: unknown;
  body?: unknown;
  description?: unknown;
  tags?: unknown;
  license?: unknown;
}): { ok: true; value: StaveFields } | { ok: false; error: string } {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return { ok: false, error: "title is required" };
  }
  if (input.title.length > MAX_TITLE) {
    return { ok: false, error: `title exceeds ${MAX_TITLE} chars` };
  }

  if (typeof input.body !== "string" || !input.body.trim()) {
    return { ok: false, error: "body is required" };
  }
  if (Buffer.byteLength(input.body, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, error: "body exceeds 1 MB" };
  }

  let description: string | null = null;
  if (input.description != null) {
    if (typeof input.description !== "string") {
      return { ok: false, error: "description must be a string" };
    }
    if (input.description.length > MAX_DESCRIPTION) {
      return { ok: false, error: `description exceeds ${MAX_DESCRIPTION} chars` };
    }
    description = input.description;
  }

  let tags: string[] = [];
  if (input.tags != null) {
    if (
      !Array.isArray(input.tags) ||
      !input.tags.every((t) => typeof t === "string")
    ) {
      return { ok: false, error: "tags must be an array of strings" };
    }
    if (input.tags.length > MAX_TAGS) {
      return { ok: false, error: `tags exceed ${MAX_TAGS} entries` };
    }
    if (input.tags.some((t) => t.length > MAX_TAG_LEN)) {
      return { ok: false, error: `each tag must be <= ${MAX_TAG_LEN} chars` };
    }
    tags = input.tags as string[];
  }

  let license: License = "CC BY 4.0";
  if (input.license != null) {
    if (!ALLOWED_LICENSES.includes(input.license as License)) {
      return { ok: false, error: "invalid license" };
    }
    license = input.license as License;
  }

  return {
    ok: true,
    value: { title: input.title, body: input.body, description, tags, license },
  };
}
