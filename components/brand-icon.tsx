export function BrandIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      data-slot="brand-icon"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect width="64" height="64" rx="16" fill="#287b6f" />
      <path d="M16 30 L32 16 L48 30 L44 30 L44 47 L20 47 L20 30 Z" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 36 L31 41 L39 33" stroke="#f4c95d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
