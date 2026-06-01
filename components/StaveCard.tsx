import Link from "next/link";
import { ArrowUp, Bookmark, Download } from "lucide-react";

export type StaveCardData = {
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  version: number;
  authorUsername?: string | null;
  savesCount?: number;
  downloadsCount?: number;
  upvotes?: number;
  downvotes?: number;
  hasNewerVersion?: boolean;
  latestSlug?: string | null;
};

export function StaveCard({ stave }: { stave: StaveCardData }) {
  const keywordTags = stave.tags.slice(0, 4);
  const score = (stave.upvotes ?? 0) - (stave.downvotes ?? 0);

  return (
    <Link href={`/staves/${stave.slug}`} className="stave-card">
      <div className="stave-card-top">
        <div className="stave-card-title">{stave.title}</div>
        <div className="stave-card-title-tags">
          <span className="tag stave-type">Stave</span>
          <span className="tag hi">v{stave.version}</span>
        </div>
      </div>

      {stave.authorUsername ? (
        <div className="stave-card-author">
          by <span>{stave.authorUsername}</span>
        </div>
      ) : null}

      {stave.description ? (
        <div className="stave-card-desc">{stave.description}</div>
      ) : null}

      {keywordTags.length > 0 ? (
        <div className="stave-card-tags">
          {keywordTags.map((tag) => (
            <span key={`${stave.slug}-${tag}`} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="stave-card-footer">
        <span className="stat">
          <Bookmark size={11} aria-hidden />
          <strong>{(stave.savesCount ?? 0).toLocaleString()}</strong> saves
        </span>
        <span className="stat">
          <Download size={11} aria-hidden />
          <strong>{(stave.downloadsCount ?? 0).toLocaleString()}</strong> DL
        </span>
        <span className="stat">
          <ArrowUp size={11} aria-hidden /> {score.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}
