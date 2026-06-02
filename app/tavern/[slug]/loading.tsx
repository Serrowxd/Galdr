export default function ThreadLoading() {
  return (
    <div className="container thread-page-skeleton">
      <div className="thread-skel-main">
        <div className="skel skel-title" />
        <div className="skel skel-meta" />
        <div className="skel skel-body" />
        <div className="skel skel-body skel-body--short" />
        <div className="skel skel-comment" />
        <div className="skel skel-comment" />
        <div className="skel skel-comment skel-comment--reply" />
      </div>
    </div>
  );
}
