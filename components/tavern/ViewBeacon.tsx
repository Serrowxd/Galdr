"use client";

import { useEffect } from "react";

export function ViewBeacon({ threadId }: { threadId: string }) {
  useEffect(() => {
    fetch(`/api/threads/${threadId}/view`, { method: "POST" }).catch(() => {});
  }, [threadId]);
  return null;
}
