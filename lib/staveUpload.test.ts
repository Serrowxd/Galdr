import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { parseStaveZip } from "@/lib/staveUpload";

type Files = Record<string, string>;

function makeZip(files: Files): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[path] = strToU8(content);
  }
  return zipSync(entries);
}

const validYaml = `title: Code Reviewer
description: Reviews code for safety
tags:
  - security
  - review
license: MIT
`;

describe("parseStaveZip", () => {
  it("accepts a valid zip with stave.yaml + README + agent and resolves README as body", () => {
    const zip = makeZip({
      "stave.yaml": validYaml,
      "README.md": "# Readme body",
      "agent.md": "# Agent",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe("Code Reviewer");
    expect(r.value.license).toBe("MIT");
    expect(r.value.tags).toEqual(["security", "review"]);
    expect(r.value.body).toBe("# Readme body");
    // body file (README.md) excluded; manifest + agent.md remain
    const paths = r.value.files.map((f) => f.path).sort();
    expect(paths).toEqual(["agent.md", "stave.yaml"]);
  });

  it("accepts a stave.json manifest", () => {
    const zip = makeZip({
      "stave.json": JSON.stringify({ title: "JSON Stave" }),
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("JSON Stave");
      expect(r.value.license).toBe("CC BY 4.0"); // default
    }
  });

  it("uses the manifest entrypoint as body when set", () => {
    const zip = makeZip({
      "stave.yaml": "title: Entry\nentrypoint: agent.md\n",
      "agent.md": "# Agent entry",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe("# Agent entry");
  });

  it("falls back to the alphabetically-first root .md when no README/entrypoint", () => {
    const zip = makeZip({
      "stave.yaml": "title: Alpha\n",
      "b-second.md": "# B",
      "a-first.md": "# A",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe("# A");
  });

  it("rejects a file larger than 1 MB", () => {
    const zip = makeZip({
      "stave.yaml": "title: Big\n",
      "big.md": "x".repeat(1_048_577),
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("file_too_large");
  });

  it("rejects cumulative uncompressed size over 10 MB", () => {
    const files: Files = { "stave.yaml": "title: Heavy\n" };
    // 11 files of ~1 MB each (each under the per-file cap) = ~11 MB cumulative.
    for (let i = 0; i < 11; i++) files[`f${i}.md`] = "x".repeat(1_000_000);
    const r = parseStaveZip(makeZip(files));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("unpacked_too_large");
  });

  it("rejects more than 50 files", () => {
    const files: Files = {};
    for (let i = 0; i < 51; i++) files[`f${i}.md`] = "x";
    const r = parseStaveZip(makeZip(files));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("too_many_files");
  });

  it("rejects path traversal (..)", () => {
    const zip = makeZip({
      "stave.yaml": "title: Evil\n",
      "../evil.md": "x",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_path");
  });

  it("rejects absolute paths", () => {
    const zip = makeZip({
      "stave.yaml": "title: Abs\n",
      "/abs.md": "x",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_path");
  });

  it("rejects disallowed file types", () => {
    const zip = makeZip({
      "stave.yaml": "title: Bin\n",
      "image.png": "not really a png",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("disallowed_file_type");
  });

  it("rejects a missing manifest", () => {
    const r = parseStaveZip(makeZip({ "README.md": "# body" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_manifest");
  });

  it("rejects duplicate manifests", () => {
    const zip = makeZip({
      "stave.yaml": "title: A\n",
      "stave.json": JSON.stringify({ title: "B" }),
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("duplicate_manifest");
  });

  it("rejects an unparseable manifest", () => {
    const zip = makeZip({
      "stave.json": "{ not valid json",
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_manifest");
  });

  it("rejects an over-long manifest title", () => {
    const zip = makeZip({
      "stave.json": JSON.stringify({ title: "a".repeat(250) }),
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("manifest_validation_failed");
  });

  it("rejects too many manifest tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `t${i}`);
    const zip = makeZip({
      "stave.json": JSON.stringify({ title: "Tagged", tags }),
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("manifest_validation_failed");
  });

  it("rejects a license outside the allowed set", () => {
    const zip = makeZip({
      "stave.json": JSON.stringify({ title: "Lic", license: "WTFPL" }),
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_license");
  });

  it("rejects an entrypoint that does not exist", () => {
    const zip = makeZip({
      "stave.yaml": "title: Missing\nentrypoint: nope.md\n",
      "README.md": "# body",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("entrypoint_not_found");
  });

  it("returns no_body_candidate when there is no resolvable body", () => {
    // manifest present, but only a non-md file and no entrypoint
    const zip = makeZip({
      "stave.yaml": "title: NoBody\n",
      "notes.txt": "just text",
    });
    const r = parseStaveZip(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("no_body_candidate");
  });

  it("rejects bytes that are not a zip", () => {
    const r = parseStaveZip(strToU8("this is definitely not a zip archive"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_a_zip");
  });
});
