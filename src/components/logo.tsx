export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#2a78d6" />
      <path
        d="M17 30.5 32 18l15 12.5V46a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3Z"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="37.5" r="5.5" fill="#fff" />
    </svg>
  );
}
