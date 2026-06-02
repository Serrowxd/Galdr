import Link from "next/link";
import { ArrowUp, Bookmark, Download, Workflow } from "lucide-react";

export type GrimoireCardData = {
  slug: string;
  title: string;
  shortDescription: string | null;
  tags: string[];
  version: number;
  staveCount: number;
  sourceCount?: number;
  authorUsername?: string | null;
  savesCount?: number;
  upvotes?: number;
  downvotes?: number;
  downloadsCount?: number;
};

const ORCHESTRATION_TAG = "orchestration";

export function GrimoireCard({ grimoire }: { grimoire: GrimoireCardData }) {
  const isOrchestration = grimoire.tags.includes(ORCHESTRATION_TAG);
  const keywordTags = grimoire.tags
    .filter((t) => t !== ORCHESTRATION_TAG)
    .slice(0, 4);
  const score = (grimoire.upvotes ?? 0) - (grimoire.downvotes ?? 0);

  return (
    <Link
      href={`/grimoires/${grimoire.slug}`}
      className={`stave-card${isOrchestration ? " is-orchestration" : ""}`}
    >
      <div className="stave-card-top">
        <div className="stave-card-title">{grimoire.title}</div>
        <div className="stave-card-title-tags">
          {isOrchestration ? (
            <span
              className="orch-symbol"
              title="Orchestration"
              aria-label="Orchestration"
            >
              <Workflow size={13} aria-hidden />
            </span>
          ) : null}
          <span className="tag grimoire-type">Grimoire</span>
        </div>
      </div>

      {grimoire.authorUsername ? (
        <div className="stave-card-author">
          by <span>{grimoire.authorUsername}</span>
        </div>
      ) : null}

      {grimoire.shortDescription ? (
        <div className="stave-card-desc">{grimoire.shortDescription}</div>
      ) : null}

      {keywordTags.length > 0 ? (
        <div className="stave-card-tags">
          {keywordTags.map((tag) => (
            <span key={`${grimoire.slug}-${tag}`} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="stave-card-footer">
        <span className="stat">
          <strong>{grimoire.staveCount}</strong>{" "}
          {grimoire.staveCount === 1 ? "stave" : "staves"}
        </span>
        <span className="stat">
          <Bookmark size={11} aria-hidden />
          <strong>{(grimoire.savesCount ?? 0).toLocaleString()}</strong> saves
        </span>
        <span className="stat">
          <Download size={11} aria-hidden />
          <strong>{(grimoire.downloadsCount ?? 0).toLocaleString()}</strong> DL
        </span>
        <span className="stat">
          <ArrowUp size={11} aria-hidden /> {score.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}
