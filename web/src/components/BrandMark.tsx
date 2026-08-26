/**
 * The ▚ brand mark — the quadrant glyph from `.github/assets/logo.svg`, drawn
 * without its background tile since every place it appears already has one.
 *
 * The full logo leaves the second diagonal hollow. A hairline stroke vanishes
 * at header size, so `hollow` is opt-in and reserved for large placements
 * (24px and up); below that those quadrants are filled with `--line2`, which
 * keeps the same read at 15px. Both colours are tokens, so the mark follows
 * the theme.
 */
export function BrandMark({ size = 15, hollow = false }: { size?: number; hollow?: boolean }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="18" height="18" rx="4" fill="var(--cyan)" />
      <rect x="22" y="22" width="18" height="18" rx="4" fill="var(--cyan)" />
      {hollow ? (
        <>
          <rect x="23.25" y="1.25" width="15.5" height="15.5" rx="3" fill="none" stroke="var(--line2)" strokeWidth="2.5" />
          <rect x="1.25" y="23.25" width="15.5" height="15.5" rx="3" fill="none" stroke="var(--line2)" strokeWidth="2.5" />
        </>
      ) : (
        <>
          <rect x="22" width="18" height="18" rx="4" fill="var(--line2)" />
          <rect y="22" width="18" height="18" rx="4" fill="var(--line2)" />
        </>
      )}
    </svg>
  );
}
