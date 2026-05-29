"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";

type DraftGrimoire = { id: string; title: string };

export function AddToGrimoireDialog({
  staveFamilyId,
  onClose,
  onAdded,
}: {
  staveFamilyId: string;
  onClose: () => void;
  onAdded: (title: string) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftGrimoire[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/grimoires?status=draft");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { rows: DraftGrimoire[] };
        setDrafts(data.rows);
      } catch {
        setError("Could not load your drafts.");
        setDrafts([]);
      }
    })();
  }, []);

  const addTo = (g: DraftGrimoire) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${g.id}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stave_family_id: staveFamilyId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "add failed");
        }
        onAdded(g.title);
        onClose();
      } catch (e) {
        setError(
          e instanceof Error && e.message === "invalid_family"
            ? "This stave can't be added (no published version)."
            : "Could not add to grimoire.",
        );
      }
    });
  };

  const createAndAdd = () => {
    startTransition(async () => {
      setError(null);
      try {
        const createRes = await fetch("/api/grimoires", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Untitled grimoire" }),
        });
        if (!createRes.ok) throw new Error();
        const { id } = (await createRes.json()) as { id: string };
        await fetch(`/api/grimoires/${id}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stave_family_id: staveFamilyId }),
        });
        router.push(`/grimoires/${id}/edit`);
      } catch {
        setError("Could not create a grimoire.");
      }
    });
  };

  return (
    <div
      className="grimoire-dialog-overlay"
      role="dialog"
      aria-label="Add to grimoire"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="grimoire-dialog">
        <div className="stave-comments-head" style={{ justifyContent: "space-between" }}>
          <span>Add to grimoire</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {drafts === null ? (
          <p className="muted">Loading your drafts…</p>
        ) : drafts.length === 0 ? (
          <p className="muted">You have no draft grimoires yet.</p>
        ) : (
          <ul className="side-card-list">
            {drafts.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => addTo(g)}
                  disabled={pending}
                  style={{ width: "100%", textAlign: "left" }}
                >
                  {g.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="stave-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="empty-state-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={createAndAdd}
            disabled={pending}
          >
            Create new grimoire
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Only draft grimoires can be edited. Published grimoires are immutable.
        </p>
      </div>
    </div>
  );
}
