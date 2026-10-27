// Brand logo: fox head + wordmark.
export default function Logo({ withText = true, small = false }: { withText?: boolean; small?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={small ? 30 : 40} height={small ? 30 : 40} viewBox="0 0 100 100" role="img" aria-label="Ертегі диктант логотипі">
        <circle cx="50" cy="50" r="47" fill="#FFC53D" />
        <circle cx="50" cy="52" r="36" fill="#F97316" />
        <path d="M26 40 L20 14 L44 30 Z" fill="#F97316" />
        <path d="M74 40 L80 14 L56 30 Z" fill="#F97316" />
        <path d="M28 36 L24 20 L38 29 Z" fill="#7C2D12" />
        <path d="M72 36 L76 20 L62 29 Z" fill="#7C2D12" />
        <ellipse cx="38" cy="56" rx="11" ry="9" fill="#FFF7ED" />
        <ellipse cx="62" cy="56" rx="11" ry="9" fill="#FFF7ED" />
        <circle cx="41" cy="48" r="4" fill="#1F2937" />
        <circle cx="59" cy="48" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="60" rx="8" ry="6" fill="#FFF7ED" />
        <circle cx="50" cy="58" r="3" fill="#1F2937" />
        <path d="M38 50 Q50 42 62 50 L60 34 Q50 26 40 34 Z" fill="#FFF7ED" />
        <path d="M36 46 Q50 38 64 46 Z" fill="#EF4444" />
      </svg>
      {withText && (
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: small ? '1rem' : '1.25rem', letterSpacing: '0.01em' }}>
          Ертегі&nbsp;<span style={{ color: 'var(--orange-deep)' }}>диктант</span>
        </span>
      )}
    </span>
  );
}
