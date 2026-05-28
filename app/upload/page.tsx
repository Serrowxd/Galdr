"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileArchive, UploadCloud } from "lucide-react";

import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { createClient } from "@/lib/supabase/client";

// Human-readable copy for the structured error codes from /api/staves/upload.
// Kept inline so the heavy server-only parser (fflate/yaml) never enters the bundle.
const ERROR_LABELS: Record<string, string> = {
  missing_content_length: "The upload was missing a size header. Try again.",
  too_large: "That file is over the 10 MB limit.",
  not_a_zip: "That doesn't look like a .zip archive.",
  too_many_files: "A stave package can contain at most 50 files.",
  file_too_large: "One of the files is over the 1 MB per-file limit.",
  unpacked_too_large: "The unpacked package is over the 10 MB limit.",
  invalid_entry_type: "The archive has an entry that isn't a regular file.",
  invalid_path: "The archive contains an unsafe file path.",
  disallowed_file_type: "Only .md, .txt, .json, .yaml, and .yml files are allowed.",
  missing_manifest: "The archive must include a stave.yaml (or stave.json) at its root.",
  duplicate_manifest: "Include only one of stave.yaml or stave.json, not both.",
  invalid_manifest: "The manifest couldn't be parsed. Check the YAML/JSON syntax.",
  manifest_validation_failed: "The manifest is missing or has invalid fields.",
  invalid_license: "The manifest license must be CC BY 4.0, CC0, MIT, or ARR.",
  entrypoint_not_found: "The manifest entrypoint points to a file that isn't in the archive.",
  no_body_candidate: "Couldn't find a body file. Add a README.md or set an entrypoint.",
  db_error: "Something went wrong saving the stave. Try again.",
};

function describeError(error: string, details?: { path?: string }): string {
  const base = ERROR_LABELS[error] ?? "The upload could not be processed.";
  return details?.path ? `${base} (${details.path})` : base;
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);
  const isLoaded = user !== undefined;
  const isSignedIn = user != null;

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError(ERROR_LABELS.not_a_zip);
      return;
    }
    if (file.size > 10_485_760) {
      setError(ERROR_LABELS.too_large);
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/staves/upload", { method: "POST", body });
      if (res.status === 201) {
        const { id } = (await res.json()) as { id: string };
        router.push(`/loom?id=${id}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { path?: string };
      };
      setError(describeError(data.error ?? "db_error", data.details));
    } catch {
      setError("Network error during upload. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <section className="container">
      <div className="page-hero">
        <p className="page-hero-tag">Author a stave</p>
        <h1>Import a stave</h1>
        <p className="page-hero-sub">
          Upload a zipped stave package. It lands as a draft in the Loom for review
          before you publish.
        </p>
      </div>

      {isLoaded && !isSignedIn ? (
        <div className="upload-gate">
          <p className="muted">Sign in to import a stave package.</p>
          <GaldrSignInButton>
            <span className="btn btn-primary btn-sm">Sign in</span>
          </GaldrSignInButton>
        </div>
      ) : (
        <>
          <div
            className={`upload-drop ${dragging ? "is-dragging" : ""} ${uploading ? "is-busy" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !uploading) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <UploadCloud size={28} aria-hidden />
            <p className="upload-drop-title">
              {uploading
                ? "Uploading…"
                : fileName
                  ? fileName
                  : "Drop a .zip here, or click to browse files"}
            </p>
            <p className="upload-drop-hint">
              Up to 10 MB · 50 files · must include <code>stave.yaml</code>
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {error ? (
            <p className="upload-error" role="alert">
              <FileArchive size={14} aria-hidden /> {error}
            </p>
          ) : null}

          <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
            Need help? Your archive needs a root <code>stave.yaml</code> manifest with at
            least a <code>title</code>. Markdown, text, JSON, and YAML files are allowed.{" "}
            <Link href="/loom">Prefer to write by hand? Open the Loom.</Link>
          </p>
        </>
      )}
    </section>
  );
}
