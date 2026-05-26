import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { normalizeGrimoirePathSlug } from "@/lib/grimoireSlug";
import type { Stave } from "@/lib/mockData";
import { createClient } from "@/lib/supabase/server";
import { getDistinctScribeSlugs, getStavesByScribeSlug } from "@/lib/staves";

/** Public profile fields looked up by username slug (case-insensitive). */
type ProfileRow = {
  userId: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
};

async function findProfileBySlug(slug: string): Promise<ProfileRow | null> {
  const db = getDbOptional();
  if (!db) return null;
  const [row] = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      bio: userProfiles.bio,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(sql`lower(${userProfiles.username}) = ${slug}`)
    .limit(1);
  return row ?? null;
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getDistinctScribeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normalizeGrimoirePathSlug(raw);
  if (!slug.length) return { title: "Grimoire | Galdr" };

  const rows = getStavesByScribeSlug(slug);
  if (rows.length) {
    const name = rows[0].scribe;
    return {
      title: `${name} · Grimoire | Galdr`,
      description: `Staves authored by ${name}.`,
    };
  }

  const profile = await findProfileBySlug(slug);
  if (profile) {
    return {
      title: `${profile.username} · Grimoire | Galdr`,
      description: `Staves authored by ${profile.username}.`,
    };
  }

  return { title: "Grimoire | Galdr" };
}

export default async function GrimoireSlugPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = normalizeGrimoirePathSlug(raw);
  if (!slug.length) notFound();

  const authored = getStavesByScribeSlug(slug);
  if (authored.length > 0) {
    return <FilledGrimoire authored={authored} />;
  }

  // Real user profiles are public: anyone can view a scribe's grimoire by slug.
  const profile = await findProfileBySlug(slug);
  if (!profile) notFound();

  // The signed-in owner gets owner-specific framing/CTAs; the avatar itself is
  // public (mirrored onto the profile row) so every visitor sees the same one.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.userId;

  return (
    <ProfileGrimoire
      username={profile.username}
      bio={profile.bio}
      avatarUrl={profile.avatarUrl}
      isOwner={isOwner}
    />
  );
}

function FilledGrimoire({ authored }: { authored: Stave[] }) {
  const name = authored[0].scribe;
  const totalInvocations = authored.reduce((acc, s) => acc + s.invocations, 0);
  const avgSuccess = Math.round(
    authored.reduce((acc, s) => acc + s.successRate, 0) / authored.length,
  );
  const bindingsUsed = authored.reduce((acc, s) => acc + s.bindings, 0);

  return (
    <>
      <div className="container">
        <article className="profile-head">
          <div className="profile-avatar" aria-hidden>
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="profile-meta">
            <p className="page-hero-tag" style={{ marginBottom: 4 }}>
              Scribe
            </p>
            <h1 className="profile-name">{name}</h1>
            <p className="profile-sub">{authored.length} staves in registry</p>
          </div>
        </article>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>
        <section className="stats-grid" aria-label="Scribe statistics">
          <article className="stat-cell">
            <span className="stat-label">Total staves</span>
            <span className="stat-value">{authored.length}</span>
          </article>
          <article className="stat-cell">
            <span className="stat-label">Total invocations</span>
            <span className="stat-value">{totalInvocations.toLocaleString()}</span>
          </article>
          <article className="stat-cell">
            <span className="stat-label">Avg success rate</span>
            <span className="stat-value success">{avgSuccess}%</span>
          </article>
          <article className="stat-cell">
            <span className="stat-label">Bindings used</span>
            <span className="stat-value">{bindingsUsed}</span>
          </article>
        </section>

        <div className="section-head" style={{ marginTop: 28 }}>
          <h2>Authored staves</h2>
          <span className="muted">{authored.length} total</span>
        </div>

        <div className="stave-grid">
          {authored.map((stave) => (
            <StaveCard key={stave.id} stave={stave} />
          ))}
        </div>

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

function ProfileGrimoire({
  username,
  bio,
  avatarUrl,
  isOwner,
}: {
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
}) {
  const t = username.trim();
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
          {avatarUrl ? (
            <Image
              className="profile-avatar-img"
              src={avatarUrl}
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
              {isOwner ? "Your grimoire" : "Scribe"}
            </p>
            <h1 className="profile-name">{username}</h1>
            {bio ? <p className="profile-sub">{bio}</p> : null}
            <p className="profile-sub">0 staves in registry</p>
          </div>
        </article>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>
        <section className="stats-grid" aria-label="Scribe statistics">
          <article className="stat-cell">
            <span className="stat-label">Total staves</span>
            <span className="stat-value">0</span>
          </article>
          <article className="stat-cell">
            <span className="stat-label">Total invocations</span>
            <span className="stat-value">0</span>
          </article>
          <article className="stat-cell">
            <span className="stat-label">Avg success rate</span>
            <span className="stat-value success">—</span>
          </article>
          <article className="stat-cell">
            <span className="stat-label">Bindings used</span>
            <span className="stat-value">0</span>
          </article>
        </section>

        <div className="section-head" style={{ marginTop: 28 }}>
          <h2>Authored staves</h2>
        </div>

        <div style={{ paddingTop: 20, paddingBottom: 32 }}>
          <article className="empty-state">
            <h2>No staves yet</h2>
            {isOwner ? (
              <>
                <p>
                  Nothing tied to your username appears in the demo registry.
                  Browse existing work or draft something new in the Loom.
                </p>
                <div className="empty-state-actions">
                  <Link href="/" className="btn btn-soft btn-sm">
                    Browse registry
                  </Link>
                  <Link href="/loom" className="btn btn-primary btn-sm">
                    Open the Loom
                  </Link>
                </div>
              </>
            ) : (
              <p>{username} hasn&apos;t published any staves yet.</p>
            )}
          </article>
        </div>

        <p className="muted" style={{ padding: "8px 0 24px" }}>
          {isOwner ? (
            <>
              <Link href="/library">← Your library</Link>
              <span aria-hidden> · </span>
              <Link href="/">Registry</Link>
            </>
          ) : (
            <Link href="/">← Back to Registry</Link>
          )}
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
