import Link from "next/link";
import { ArrowRight, Eye, Flame, Sparkles, Users } from "lucide-react";
import { VegvisirLogo } from "@/components/VegvisirLogo";
import { staves } from "@/lib/mockData";

const highlights = [
  {
    icon: Sparkles,
    title: "Curated drafts",
    description:
      "Daily hand-picked rituals from the registry, tuned for stylistic experiments and practical deployment.",
  },
  {
    icon: Users,
    title: "Scribe circles",
    description:
      "Follow specialist builders, remix their staves, and track collaborative forks as they evolve.",
  },
  {
    icon: Flame,
    title: "Pulse ranking",
    description:
      "Scoreboards blend popularity, reliability, and active discussion for a living creative feed.",
  },
];

export default function LandingPage() {
  const featuredStaves = [...staves]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 3);

  const trendingStaves = [...staves]
    .sort((a, b) => b.commentsCount + b.upvotes - (a.commentsCount + a.upvotes))
    .slice(0, 4);

  const totalInvocations = staves.reduce((sum, stave) => sum + stave.invocations, 0);
  const totalScribes = new Set(staves.map((stave) => stave.scribe)).size;
  const avgSuccessRate = Math.round(
    staves.reduce((sum, stave) => sum + stave.successRate, 0) / staves.length,
  );

  const latestPublishedAt = Math.max(
    ...staves.map((stave) => new Date(stave.publishedAt).getTime()),
  );
  const dayBuckets = Array.from({ length: 7 }, (_, index) => {
    const bucketDate = new Date(latestPublishedAt);
    bucketDate.setUTCHours(0, 0, 0, 0);
    bucketDate.setUTCDate(bucketDate.getUTCDate() - (6 - index));
    const dayKey = bucketDate.toISOString().slice(0, 10);
    return {
      dayKey,
      label: bucketDate.toLocaleDateString("en-US", { weekday: "short" }),
      count: staves.filter((stave) => stave.publishedAt.slice(0, 10) === dayKey).length,
    };
  });
  const maxDailyCount = Math.max(...dayBuckets.map((bucket) => bucket.count), 1);
  const chartWidth = 260;
  const chartHeight = 72;
  const chartPadding = 8;
  const stepX = (chartWidth - chartPadding * 2) / (dayBuckets.length - 1);
  const pointToY = (count: number) =>
    chartHeight - chartPadding - (count / maxDailyCount) * (chartHeight - chartPadding * 2);
  const linePath = dayBuckets
    .map((bucket, index) => {
      const x = chartPadding + index * stepX;
      const y = pointToY(bucket.count);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <section className="landing-screen" aria-labelledby="landing-title">
      <div className="container landing-stack">
        <div className="landing-main">
          <header className="landing-hero landing-headstone">
            <div className="landing-headstone-top">
              <div className="landing-badge">
                <VegvisirLogo size={58} className="logo-pulse" />
                <div>
                  <p className="landing-kicker">Creative Agent Network</p>
                  <h1 id="landing-title" className="hero-title">
                    Galdr
                  </h1>
                </div>
              </div>
              <Link href="/registry" className="landing-headstone-link">
                Open Registry <ArrowRight size={14} />
              </Link>
            </div>
            <div className="landing-headstone-stats" aria-label="Network stats">
              <span className="landing-headstone-stat">
                <strong>{totalScribes}</strong> scribes
              </span>
              <span className="landing-headstone-stat">
                <strong>{staves.length}</strong> staves
              </span>
              <span className="landing-headstone-stat">
                <strong>{totalInvocations.toLocaleString()}</strong> invocations
              </span>
              <span className="landing-headstone-stat">
                <strong>{avgSuccessRate}%</strong> avg success
              </span>
            </div>
            <div className="landing-headstone-chart" aria-label="New staves per day">
              <div className="landing-headstone-chart-head">
                <span>New staves by day</span>
                <span>{dayBuckets.reduce((sum, bucket) => sum + bucket.count, 0)} this week</span>
              </div>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="landing-headstone-chart-svg"
                role="img"
                aria-label="Line chart of new staves per day"
              >
                <path d={linePath} className="landing-headstone-line" />
                {dayBuckets.map((bucket, index) => {
                  const x = chartPadding + index * stepX;
                  const y = pointToY(bucket.count);
                  return (
                    <circle
                      key={bucket.dayKey}
                      cx={x}
                      cy={y}
                      r="2.4"
                      className="landing-headstone-dot"
                    />
                  );
                })}
              </svg>
              <div className="landing-headstone-chart-labels" aria-hidden="true">
                {dayBuckets.map((bucket) => (
                  <span key={bucket.dayKey}>{bucket.label}</span>
                ))}
              </div>
            </div>
          </header>

          <aside className="landing-pulse-board" aria-label="Trending activity">
            <h2>Trending right now</h2>
            <ul>
              {trendingStaves.map((stave) => (
                <li key={stave.id}>
                  <div className="landing-pulse-head">
                    <strong>{stave.title}</strong>
                    <span>#{stave.popularityScore}</span>
                  </div>
                  <p>by {stave.scribe}</p>
                  <div className="landing-pulse-metrics">
                    <span>
                      <Eye size={12} aria-hidden="true" />
                      {stave.viewsCount.toLocaleString()}
                    </span>
                    <span>{stave.commentsCount} comments</span>
                    <span>{stave.successRate}% success</span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <section className="landing-feature-rail" aria-label="Featured staves">
          {featuredStaves.map((stave) => (
            <article key={stave.id} className="landing-feature landing-showcase-card">
              <div className="landing-showcase-top">
                <span className="landing-showcase-label">Featured</span>
                <span className="landing-showcase-rank">
                  Popularity {stave.popularityScore}
                </span>
              </div>
              <div className="landing-showcase-head">
                <h2>{stave.title}</h2>
                <p>by {stave.scribe}</p>
              </div>
              <p>{stave.description}</p>
              <div className="landing-showcase-tags">
                {stave.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag">
                    #{tag}
                  </span>
                ))}
              </div>
              <footer className="landing-showcase-meta">
                <span>{stave.invocations.toLocaleString()} invocations</span>
                <span>{stave.bindings} bindings</span>
                <span>{stave.successRate}% reliable</span>
              </footer>
            </article>
          ))}
        </section>

        <section className="landing-story-strip" aria-label="Creative highlights">
          {highlights.map((item) => (
            <article key={item.title} className="landing-story-pill">
              <item.icon size={16} className="feature-icon" aria-hidden="true" />
              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </section>

        <footer className="landing-meta" aria-label="Landing footer">
          <span>© 2026 Galdr Network</span>
          <span>Built for featured feeds, living archives, and ritual authors.</span>
        </footer>
      </div>
    </section>
  );
}
