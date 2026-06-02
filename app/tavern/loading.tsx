export default function TavernLoading() {
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="tavern-layout">
        {/* sidenav skeleton */}
        <aside className="tavern-sidenav">
          <div className="tavern-skel-block" style={{ height: 200 }} />
        </aside>

        {/* feed skeleton */}
        <main className="tavern-feed">
          <div className="tavern-skel-block" style={{ height: 40, marginBottom: 16 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="tavern-skel-block thread-row-skel"
              style={{ marginBottom: 8 }}
            />
          ))}
        </main>

        {/* rail skeleton */}
        <aside className="tavern-rail">
          <div className="tavern-skel-block" style={{ height: 180 }} />
        </aside>
      </div>
    </div>
  );
}
