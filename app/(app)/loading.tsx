export default function Loading() {
  return (
    <div className="view" aria-label="加载中">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--hero" />
      <div className="skeleton skeleton--card" />
    </div>
  );
}
