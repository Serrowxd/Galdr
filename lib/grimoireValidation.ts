import { ALLOWED_LICENSES, type License } from "@/lib/staveValidation";

const MAX_TITLE = 200;
const MAX_SHORT_DESC = 500;
const MAX_DETAILS = 20000;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 32;

export type GrimoireFields = {
  title: string;
  shortDescription: string | null;
  details: string | null;
  tags: string[];
  license: License;
};

/** Validates the size/shape rules for grimoire create/update (mirrors staveValidation). */
export function validateGrimoireFields(input: {
  title?: unknown;
  short_description?: unknown;
  details?: unknown;
  tags?: unknown;
  license?: unknown;
}): { ok: true; value: GrimoireFields } | { ok: false; error: string } {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return { ok: false, error: "title is required" };
  }
  if (input.title.length > MAX_TITLE) {
    return { ok: false, error: `title exceeds ${MAX_TITLE} chars` };
  }

  let shortDescription: string | null = null;
  if (input.short_description != null) {
    if (typeof input.short_description !== "string") {
      return { ok: false, error: "short_description must be a string" };
    }
    if (input.short_description.length > MAX_SHORT_DESC) {
      return { ok: false, error: `short_description exceeds ${MAX_SHORT_DESC} chars` };
    }
    shortDescription = input.short_description;
  }

  let details: string | null = null;
  if (input.details != null) {
    if (typeof input.details !== "string") {
      return { ok: false, error: "details must be a string" };
    }
    if (input.details.length > MAX_DETAILS) {
      return { ok: false, error: `details exceeds ${MAX_DETAILS} chars` };
    }
    details = input.details;
  }

  let tags: string[] = [];
  if (input.tags != null) {
    if (!Array.isArray(input.tags) || !input.tags.every((t) => typeof t === "string")) {
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

  return { ok: true, value: { title: input.title, shortDescription, details, tags, license } };
}
