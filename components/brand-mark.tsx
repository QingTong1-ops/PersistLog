export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <span
      className="brand-mark"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M4 17.5c3.2 0 4.5-3.3 6.3-6.5C11.9 7.4 13.6 5 17 5" />
        <path d="M7 19.2c3.8 0 5.2-4.5 7.4-8.2 1.7-2.8 3.4-4.5 5.6-4.5" />
        <circle cx="17.8" cy="17.2" r="2.1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
