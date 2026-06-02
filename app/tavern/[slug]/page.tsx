import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import {
  getThreadBySlug,
  listComments,
  listRelatedThreads,
  getAttachedStaveCard,
} from "@/lib/threads";
import { ThreadPageView } from "@/components/tavern/ThreadPageView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const thread = await getThreadBySlug(slug);
  if (!thread) return { title: "Thread | Galdr" };
  return {
    title: `${thread.title} | Galdr`,
  };
}

export default async function ThreadPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sort } = await searchParams;

  const thread = await getThreadBySlug(slug);
  if (!thread) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [comments, related, staveCard] = await Promise.all([
    listComments(thread.id, sort === "new" ? "new" : "top"),
    listRelatedThreads(thread.id, 3),
    thread.staveFamilyId ? getAttachedStaveCard(thread.staveFamilyId) : Promise.resolve(null),
  ]);

  const isAuthor = user?.id === thread.authorId;
  const isStaveAuthor = thread.staveAuthorId ? user?.id === thread.staveAuthorId : false;
  const surface = thread.format === "documentation" ? "doc" : "forum";

  return (
    <ThreadPageView
      thread={thread}
      comments={comments}
      related={related}
      staveCard={staveCard}
      surface={surface}
      isAuthor={isAuthor}
      isStaveAuthor={isStaveAuthor}
      viewerId={user?.id ?? null}
      sort={sort === "new" ? "new" : "top"}
    />
  );
}
