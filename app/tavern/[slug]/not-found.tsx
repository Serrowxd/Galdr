import Link from "next/link";

export default function ThreadNotFound() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="empty-state" style={{ maxWidth: 480 }}>
        <h2>Thread not found</h2>
        <p>This thread may have been removed or the link is incorrect.</p>
        <div className="empty-state-actions">
          <Link href="/tavern" className="btn btn-ghost btn-sm">
            Back to Tavern
          </Link>
        </div>
      </div>
    </div>
  );
}
