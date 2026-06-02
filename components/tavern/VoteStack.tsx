"use client";

import { formatScore } from "@/lib/format/score";
import {
  useOptimisticVote,
  type VoteTarget,
} from "@/hooks/useOptimisticVote";

interface VoteStackProps {
  target: VoteTarget;
  score: number;
  viewerVote: -1 | 0 | 1;
  /** When true (anon viewer), buttons are disabled. */
  disabled?: boolean;
}

/**
 * Vertical vote column used on thread OP rows and feed cards.
 * Renders: ▲ → score → ▼
 */
export function VoteStack({
  target,
  score,
  viewerVote,
  disabled = false,
}: VoteStackProps) {
  const [optimisticScore, optimisticVote, castVote] = useOptimisticVote(
    target,
    score,
    viewerVote,
  );

  function handleUp() {
    // Clicking Up while already Up clears the vote (sends 0).
    castVote(optimisticVote === 1 ? 0 : 1);
  }

  function handleDown() {
    // Clicking Down while already Down clears the vote (sends 0).
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
    <div className="vote-stack">
      <button
        className={`vote-stack__arrow${optimisticVote === 1 ? " is-active" : ""}`}
        onClick={handleUp}
        disabled={disabled}
        title={upTitle}
        aria-label={upTitle}
        aria-pressed={optimisticVote === 1}
        type="button"
      >
        ▲
      </button>
      <span className="vote-stack__score" aria-live="polite">
        {formatScore(optimisticScore)}
      </span>
      <button
        className={`vote-stack__arrow${optimisticVote === -1 ? " is-active" : ""}`}
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
