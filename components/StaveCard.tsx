import Link from "next/link";

export type StaveCardData = {
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  version: number;
  upvotes?: number;
  downvotes?: number;
  hasNewerVersion?: boolean;
  latestSlug?: string | null;
};

export function StaveCard({ stave }: { stave: StaveCardData }) {
  const score = (stave.upvotes ?? 0) - (stave.downvotes ?? 0);
  return (
    <Link href={`/staves/${stave.slug}`} className="stave-card">
      <div className="stave-card-top">
        <div className="stave-card-title">
          {stave.title}
          {stave.version > 1 ? (
            <span className="tag" style={{ marginLeft: 6 }}>
              v{stave.version}
            </span>
          ) : null}
        </div>
        <div className="stave-card-score">↑ {score.toLocaleString()}</div>
      </div>

      {stave.description ? (
        <div className="stave-card-desc">{stave.description}</div>
      ) : null}

      <div className="stave-card-tags">
        {stave.tags.slice(0, 4).map((tag) => (
          <span key={`${stave.slug}-${tag}`} className="tag">
            {tag}
          </span>
        ))}
      </div>

      {stave.hasNewerVersion && stave.latestSlug ? (
        <div className="stave-card-meta">
          <span className="meta-item">Newer version available →</span>
        </div>
      ) : null}
    </Link>
  );
}
