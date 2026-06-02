"use client";

import { formatScore } from "@/lib/format/score";
import {
  useOptimisticVote,
  type VoteTarget,
} from "@/hooks/useOptimisticVote";

interface VoteMiniProps {
  target: VoteTarget;
  score: number;
  viewerVote: -1 | 0 | 1;
  /** When true (anon viewer), buttons are disabled. */
  disabled?: boolean;
}

/**
 * Horizontal inline vote pill used on comment rows.
 * Renders: ▲ score ▼ in a single flex row.
 */
export function VoteMini({
  target,
  score,
  viewerVote,
  disabled = false,
}: VoteMiniProps) {
  const [optimisticScore, optimisticVote, castVote] = useOptimisticVote(
    target,
    score,
    viewerVote,
  );

  function handleUp() {
    castVote(optimisticVote === 1 ? 0 : 1);
  }

  function handleDown() {
    castVote(optimisticVote === -1 ? 0 : -1);
  }

  const upTitle = disabled
    ? "Sign in to vote."
    : optimisticVote === 1
      ? "Remove upvote"
      : "Upvote";

  const downTitle = disabled
    ? "Sign in to vote."
    : optimisticVote === -1
      ? "Remove downvote"
      : "Downvote";

  return (
    <div className="vote-mini">
      <button
        className={`vote-mini__arrow${optimisticVote === 1 ? " is-active" : ""}`}
        onClick={handleUp}
        disabled={disabled}
        title={upTitle}
        aria-label={upTitle}
        aria-pressed={optimisticVote === 1}
        type="button"
      >
        ▲
      </button>
      <span className="vote-mini__score" aria-live="polite">
        {formatScore(optimisticScore)}
      </span>
      <button
        className={`vote-mini__arrow${optimisticVote === -1 ? " is-active" : ""}`}
        onClick={handleDown}
        disabled={disabled}
        title={downTitle}
        aria-label={downTitle}
        aria-pressed={optimisticVote === -1}
        type="button"
      >
        ▼
      </button>
    </div>
  );
}
