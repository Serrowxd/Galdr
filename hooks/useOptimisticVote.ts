import { useState } from "react";

export type VoteTarget =
  | { kind: "thread"; threadId: string }
  | { kind: "comment"; commentId: string };

function voteEndpointFor(target: VoteTarget): string {
  if (target.kind === "thread") return `/api/threads/${target.threadId}/vote`;
  return `/api/comments/${target.commentId}/vote`;
}

/**
 * Optimistic vote hook for thread or comment voting.
 *
 * Returns [optimisticScore, optimisticVote, voteFn].
 *
 * voteFn(next):
 *   - Immediately updates local state (optimistic).
 *   - Sends PUT to the appropriate endpoint with { value: next }.
 *   - On failure, reverts to the previous state and logs an error.
 */
export function useOptimisticVote(
  target: VoteTarget,
  initialScore: number,
  initialVote: -1 | 0 | 1,
): [number, -1 | 0 | 1, (next: -1 | 0 | 1) => Promise<void>] {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<-1 | 0 | 1>(initialVote);

  async function castVote(next: -1 | 0 | 1): Promise<void> {
    // Compute score delta relative to current optimistic state.
    const delta = next - vote;

    const prevScore = score;
    const prevVote = vote;

    // Optimistic update.
    setScore(score + delta);
    setVote(next);

    try {
      const res = await fetch(voteEndpointFor(target), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });

      if (!res.ok) {
        // Revert on server error.
        setScore(prevScore);
        setVote(prevVote);
        console.error(`Vote failed: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      // Revert on network error.
      setScore(prevScore);
      setVote(prevVote);
      console.error("Vote request failed:", err);
    }
  }

  return [score, vote, castVote];
}
