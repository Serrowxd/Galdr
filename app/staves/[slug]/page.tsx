import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StaveDetailClient } from "@/components/StaveDetailClient";
import { defaultTabFor, isTabId } from "@/lib/staveTabs";
import { getDbOptional } from "@/db";
import { isStaveSaved } from "@/lib/staveEngagement";
import { getUserProfileByUserId } from "@/lib/profiles";
import { listGrimoiresContainingStave } from "@/lib/grimoires";
import { createClient } from "@/lib/supabase/server";
import {
  getScribeStats,
  getStaveAttribution,
  getStaveBySlug,
  getStaveStats,
  getVersionsByFamily,
} from "@/lib/staves";
import { getStaveFiles } from "@/lib/stavePackages";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDbOptional();
  if (!db) return { title: "Stave | Galdr" };
  const stave = await getStaveBySlug(db, slug);
  if (!stave) return { title: "Stave | Galdr" };

  // Don't leak a draft/private stave's title or description to non-owners.
  if (stave.status === "draft" || stave.private) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== stave.authorId) return { title: "Stave | Galdr" };
  }

  return {
    title: `${stave.title} | Galdr`,
    description: stave.description ?? undefined,
  };
}

export default async function StaveDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const db = getDbOptional();
  if (!db) notFound();

  const stave = await getStaveBySlug(db, slug);
  if (!stave) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthor = user?.id === stave.authorId;

  // Drafts and private (unlisted) staves are owner-only.
  if ((stave.status === "draft" || stave.private) && !isAuthor) notFound();

  const status = stave.status === "published" ? "published" : "draft";

  // Everything below depends only on the already-loaded `stave`, so fetch it all
  // in one round-trip rather than waterfalling.
  const [versions, author, packageFiles, grimoires, stats, scribeStats, forkedFrom] =
    await Promise.all([
      getVersionsByFamily(db, stave.familyId),
      getUserProfileByUserId(db, stave.authorId),
      getStaveFiles(db, stave.id),
      listGrimoiresContainingStave(db, stave.familyId),
      getStaveStats(db, stave.familyId),
      getScribeStats(db, stave.authorId),
      stave.forkedFrom
        ? getStaveAttribution(db, stave.forkedFrom)
        : Promise.resolve(null),
    ]);

  // README-first default landing when the package ships a real README.md.
  const hasReadme = packageFiles.some(
    (f) => f.path.split("/").pop()?.toLowerCase() === "readme.md",
  );
  const initialTab = isTabId(tab) ? tab : defaultTabFor(hasReadme);

  const authorName = author?.username ?? "Unknown scribe";
  const sagaHref = author?.username
    ? `/saga/${author.username.toLowerCase()}`
    : "/";

  let initialSaved = false;
  if (user) {
    initialSaved = await isStaveSaved(db, stave.id, user.id);
  }

  return (
    <section className="container stave-detail-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/registry">Registry</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <Link href={sagaHref}>{authorName}</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>{stave.slug}</span>
      </nav>

      <StaveDetailClient
        stave={stave}
        authorName={authorName}
        authorAvatarUrl={author?.avatarUrl ?? null}
        sagaHref={sagaHref}
        scribeStats={scribeStats}
        isAuthor={isAuthor}
        status={status}
        initialTab={initialTab}
        versions={versions}
        grimoires={grimoires}
        stats={stats}
        packageFiles={packageFiles}
        forkedFrom={forkedFrom}
        initialSaved={initialSaved}
      />
    </section>
  );
}
