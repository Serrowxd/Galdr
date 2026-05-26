import Link from "next/link";
import { Zap } from "lucide-react";
import type { Stave } from "@/lib/mockData";

type StaveCardProps = {
  stave: Stave;
};

function formatInvocations(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${rounded}k invocations`;
  }
  return `${value} invocations`;
}

export function StaveCard({ stave }: StaveCardProps) {
  const score = stave.upvotes - stave.downvotes;
  return (
    <Link href={`/staves/${stave.id}`} className="stave-card">
      <div className="stave-card-top">
        <div className="stave-card-title">{stave.title}</div>
        <div className="stave-card-score">↑ {score.toLocaleString()}</div>
      </div>

      <div className="stave-card-scribe">by {stave.scribe}</div>

      <div className="stave-card-desc">{stave.description}</div>

      <div className="stave-card-tags">
        {stave.tags.slice(0, 4).map((tag) => (
          <span key={`${stave.id}-${tag}`} className="tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="stave-card-meta">
        <span className="meta-item">
          <Zap size={12} aria-hidden />
          {formatInvocations(stave.invocations)}
        </span>
        <span className="meta-item">
          <span className="success-dot" aria-hidden />
          {stave.successRate}% reliable
        </span>
      </div>
    </Link>
  );
}
