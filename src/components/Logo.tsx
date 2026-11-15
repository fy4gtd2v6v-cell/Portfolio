export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M7 21.5l6-6.5 4.5 3.5L25 10" stroke="var(--gold)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="10" r="2.2" fill="var(--gold)" />
    </svg>
  );
}
