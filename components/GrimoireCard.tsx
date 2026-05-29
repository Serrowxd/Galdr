import Link from "next/link";
import { ArrowUp, BookMarked, Download } from "lucide-react";

export type GrimoireCardData = {
  slug: string;
  title: string;
  shortDescription: string | null;
  tags: string[];
  version: number;
  staveCount: number;
  sourceCount?: number;
  authorUsername?: string | null;
  upvotes?: number;
  downvotes?: number;
  downloadsCount?: number;
};

const ORCHESTRATION_TAG = "orchestration";

export function GrimoireCard({ grimoire }: { grimoire: GrimoireCardData }) {
  const isOrchestration = grimoire.tags.includes(ORCHESTRATION_TAG);
  const visibleTags = grimoire.tags.filter((t) => t !== ORCHESTRATION_TAG).slice(0, 3);

  return (
    <Link href={`/grimoires/${grimoire.slug}`} className="stave-card grimoire-reg-card">
      <span className="grimoire-card-type">
        <BookMarked size={12} aria-hidden /> Grimoire
      </span>

      <div className="stave-card-title" style={{ paddingRight: 80 }}>
        {grimoire.title}
      </div>

      {grimoire.shortDescription ? (
        <div className="stave-card-desc">{grimoire.shortDescription}</div>
      ) : null}

      <div className="stave-card-tags">
        {isOrchestration ? (
          <span className="tag" data-orchestration="true">
            orchestration
          </span>
        ) : null}
        {visibleTags.map((tag) => (
          <span key={`${grimoire.slug}-${tag}`} className="tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="grimoire-card-foot">
        <span>
          <strong>{grimoire.staveCount}</strong>{" "}
          {grimoire.staveCount === 1 ? "stave" : "staves"}
          {grimoire.sourceCount != null ? (
            <>
              {" · "}
              {grimoire.sourceCount} {grimoire.sourceCount === 1 ? "author" : "authors"}
            </>
          ) : null}
          {" · "}
          <span className="tag">v{grimoire.version}</span>
        </span>
        <span className="grimoire-card-counts">
          <span>
            <ArrowUp size={11} aria-hidden /> {(grimoire.upvotes ?? 0).toLocaleString()}
          </span>
          <span>
            <Download size={11} aria-hidden />{" "}
            {(grimoire.downloadsCount ?? 0).toLocaleString()}
          </span>
        </span>
      </div>
    </Link>
  );
}
