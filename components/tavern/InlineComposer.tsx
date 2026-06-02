"use client";

import { useRouter } from "next/navigation";

import { MarkdownComposer } from "@/components/composer/MarkdownComposer";

export function InlineComposer({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string | null;
}) {
  const router = useRouter();

  return (
    <MarkdownComposer
      scope={{ type: "thread-comment", threadId }}
      placeholder="Reply with markdown…"
      submitLabel="POST REPLY"
      showCancel={false}
      maxLength={16384}
      userId={userId}
      layout="inline"
      onSubmit={async (body) => {
        const res = await fetch(`/api/threads/${threadId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!res.ok) return { ok: false, error: "Failed to post reply" };
        router.refresh();
        return { ok: true };
      }}
    />
  );
}
