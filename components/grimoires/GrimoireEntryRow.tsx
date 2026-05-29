import Link from "next/link";
import { ChevronDown, ExternalLink, Pin } from "lucide-react";

export type EntryDTO = {
  id: string;
  isOptional: boolean;
  annotation: string | null;
  pinned: boolean;
  status: "ok" | "unavailable";
  reason?: string;
  stave?: {
    title: string;
    slug: string;
    version: number;
    description: string | null;
    tags: string[];
    authorUsername: string | null;
  };
};

export function GrimoireEntryRow({
  entry,
  position,
  isLast,
  toggledOff,
  onToggle,
}: {
  entry: EntryDTO;
  position: number;
  isLast: boolean;
  toggledOff: boolean;
  onToggle: () => void;
}) {
  const unavailable = entry.status === "unavailable";
  const dimmed = unavailable || (entry.isOptional && toggledOff);

  return (
    <li className="grimoire-entry" data-dimmed={dimmed ? "true" : undefined}>
      <div className="grimoire-entry-rail" aria-hidden>
        <span
          className="grimoire-step"
          data-optional={entry.isOptional ? "true" : undefined}
        >
          {position}
        </span>
        {!isLast ? (
          <>
            <span className="grimoire-connector" />
            <ChevronDown size={14} className="grimoire-connector-arrow" aria-hidden />
          </>
        ) : null}
      </div>

      <div className="grimoire-entry-body">
        <div className="grimoire-entry-head">
          <span className="grimoire-entry-title">
            {unavailable ? (
              <s>{entry.stave?.title ?? "Unknown stave"}</s>
            ) : (
              <Link href={`/staves/${entry.stave!.slug}`}>{entry.stave!.title}</Link>
            )}
            {entry.pinned ? (
              <span className="tag" style={{ marginLeft: 6 }}>
                <Pin size={10} aria-hidden /> pinned
              </span>
            ) : null}
            {unavailable ? (
              <span className="tag" style={{ marginLeft: 6 }}>
                unavailable
              </span>
            ) : null}
          </span>
          {!unavailable ? (
            <Link
              href={`/staves/${entry.stave!.slug}`}
              className="grimoire-entry-link"
              aria-label="Open stave"
            >
              <ExternalLink size={13} />
            </Link>
          ) : null}
        </div>

        {!unavailable ? (
          <p className="grimoire-entry-author muted">
            {entry.stave!.authorUsername ?? "unknown"} · v{entry.stave!.version}
          </p>
        ) : null}

        {!unavailable && entry.stave!.description ? (
          <p className="grimoire-entry-desc">{entry.stave!.description}</p>
        ) : null}

        {entry.annotation ? (
          <p className="grimoire-annotation">{entry.annotation}</p>
        ) : null}

        {!unavailable && entry.stave!.tags.length ? (
          <div className="stave-card-tags">
            {entry.stave!.tags.slice(0, 4).map((t) => (
              <span key={`${entry.id}-${t}`} className="tag">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {entry.isOptional && !unavailable ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onToggle}
            aria-pressed={!toggledOff}
            style={{ marginTop: 6 }}
          >
            {toggledOff ? "Include (optional)" : "Exclude (optional)"}
          </button>
        ) : null}
      </div>
    </li>
  );
}
