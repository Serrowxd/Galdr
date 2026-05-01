import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { Stave } from "@/lib/mockData";

type StaveCardProps = {
  stave: Stave;
};

export function StaveCard({ stave }: StaveCardProps) {
  return (
    <Link href={`/staves/${stave.id}`} className="stave-card-link">
      <article className="stave-card">
      <div className="stave-card-head">
        <h3>{stave.title}</h3>
        <p className="stave-success">
          <CheckCircle2 size={12} />
          <span>{stave.successRate}%</span>
        </p>
      </div>

      <p className="stave-description">{stave.description}</p>

      <p className="stave-author">
        by <strong>{stave.scribe}</strong>
      </p>

      <div className="stave-meta-row" aria-label="Stave engagement metrics">
        <span>
          <MessageCircle size={13} aria-hidden="true" />
          {stave.commentsCount}
        </span>
        <span>
          <Eye size={13} aria-hidden="true" />
          {stave.viewsCount}
        </span>
        <span>
          <ThumbsUp size={13} aria-hidden="true" />
          {stave.upvotes}
        </span>
        <span>
          <ThumbsDown size={13} aria-hidden="true" />
          {stave.downvotes}
        </span>
      </div>

      <div className="stave-tags">
        {stave.tags.map((tag) => (
          <span key={`${stave.id}-${tag}`} className="tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="stave-foot">
        <span>Published {new Date(stave.publishedAt).toLocaleDateString()}</span>
      </div>
      </article>
    </Link>
  );
}
