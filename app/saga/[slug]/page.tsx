import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import { normalizeSagaPathSlug } from "@/lib/sagaSlug";
import { getUserProfileByUsername, type ProfileRow } from "@/lib/profiles";
import { getStavesByAuthor, type Stave } from "@/lib/staves";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/** Keeps only the latest version per family. */
function latestPerFamily(rows: Stave[]): Stave[] {
  const seen = new Set<string>();
  const out: Stave[] = [];
  // getStavesByAuthor returns version DESC, so the first row per family is latest.
  for (const row of rows) {
    if (seen.has(row.familyId)) continue;
    seen.add(row.familyId);
    out.push(row);
  }
  return out;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normalizeSagaPathSlug(raw);
  if (!slug.length) return { title: "Saga | Galdr" };

  const db = getDbOptional();
  if (!db) return { title: "Saga | Galdr" };

  const profile = await getUserProfileByUsername(db, slug);
  if (!profile) return { title: "Saga | Galdr" };
  return {
    title: `${profile.username} · Saga | Galdr`,
    description: `Staves authored by ${profile.username}.`,
  };
}

export default async function SagaSlugPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = normalizeSagaPathSlug(raw);
  if (!slug.length) notFound();

  const db = getDbOptional();
  if (!db) notFound();

  const profile = await getUserProfileByUsername(db, slug);
  if (!profile) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.userId;

  const publishedRows = await getStavesByAuthor(db, profile.userId, {
    status: "published",
  });
  const published = latestPerFamily(publishedRows);
  const drafts = isOwner
    ? await getStavesByAuthor(db, profile.userId, { status: "draft" })
    : [];

  return (
    <Saga
      profile={profile}
      published={published}
      drafts={drafts}
      isOwner={isOwner}
    />
  );
}

function Saga({
  profile,
  published,
  drafts,
  isOwner,
}: {
  profile: ProfileRow;
  published: Stave[];
  drafts: Stave[];
  isOwner: boolean;
}) {
  const t = profile.username.trim();
  const initials =
    t.length >= 2
      ? t.slice(0, 2).toUpperCase()
      : t.length === 1
        ? (t + t).toUpperCase()
        : "?";

  return (
    <>
      <div className="container">
        <article className="profile-head">
          {profile.avatarUrl ? (
            <Image
              className="profile-avatar-img"
              src={profile.avatarUrl}
              alt=""
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <div className="profile-avatar" aria-hidden>
              {initials}
            </div>
          )}
          <div className="profile-meta">
            <p className="page-hero-tag" style={{ marginBottom: 4 }}>
              {isOwner ? "Your saga" : "Scribe"}
            </p>
            <h1 className="profile-name">{profile.username}</h1>
            {profile.bio ? <p className="profile-sub">{profile.bio}</p> : null}
            <p className="profile-sub">
              {published.length} {published.length === 1 ? "stave" : "staves"} in
              registry
            </p>
          </div>
        </article>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>
        <section className="stats-grid" aria-label="Scribe statistics">
          <article className="stat-cell">
            <span className="stat-label">Published staves</span>
            <span className="stat-value">{published.length}</span>
          </article>
          {isOwner ? (
            <article className="stat-cell">
              <span className="stat-label">Drafts</span>
              <span className="stat-value">{drafts.length}</span>
            </article>
          ) : null}
        </section>

        <div className="section-head" style={{ marginTop: 28 }}>
          <h2>Published staves</h2>
          <span className="muted">{published.length} total</span>
        </div>

        {published.length === 0 ? (
          <div style={{ paddingTop: 20, paddingBottom: 32 }}>
            <article className="empty-state">
              <h2>No published staves yet</h2>
              {isOwner ? (
                <>
                  <p>Draft something in the Loom and publish it to the registry.</p>
                  <div className="empty-state-actions">
                    <Link href="/loom" className="btn btn-primary btn-sm">
                      Open the Loom
                    </Link>
                  </div>
                </>
              ) : (
                <p>{profile.username} hasn&apos;t published any staves yet.</p>
              )}
            </article>
          </div>
        ) : (
          <div className="stave-grid">
            {published.map((stave) => (
              <StaveCard key={stave.id} stave={stave} />
            ))}
          </div>
        )}

        {isOwner && drafts.length > 0 ? (
          <>
            <div className="section-head" style={{ marginTop: 28 }}>
              <h2>Drafts</h2>
              <span className="muted">{drafts.length} total</span>
            </div>
            <div className="stave-grid">
              {drafts.map((stave) => (
                <StaveCard key={stave.id} stave={stave} />
              ))}
            </div>
          </>
        ) : null}

        <p className="muted" style={{ padding: "24px 0" }}>
          <Link href="/library">← Your library</Link>
          <span aria-hidden> · </span>
          <Link href="/">Registry</Link>
        </p>
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
        </div>
      </footer>
    </>
  );
}
