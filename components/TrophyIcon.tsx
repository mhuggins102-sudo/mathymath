"use client";

/** Trophy SVG used for achievement tier indicators. Renders in
 *  `currentColor` so the parent can swap bronze / gold / locked via
 *  Tailwind text utilities. */
export type TrophyTier = "locked" | "bronze" | "gold";

const TIER_COLOR: Record<TrophyTier, string> = {
  locked: "text-muted/40",
  bronze: "text-amber-700",
  gold: "text-amber-400",
};

const SIZE_CLASS = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-9 h-9",
} as const;

export function TrophyIcon({
  tier,
  size = "md",
}: {
  tier: TrophyTier;
  size?: keyof typeof SIZE_CLASS;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${SIZE_CLASS[size]} ${TIER_COLOR[tier]}`}
      aria-hidden
    >
      <path d="M7 4h10v2h2.5A1.5 1.5 0 0 1 21 7.5V9a4 4 0 0 1-4 4 5 5 0 0 1-4 3.9V18h3a1 1 0 0 1 1 1v1H7v-1a1 1 0 0 1 1-1h3v-1.1A5 5 0 0 1 7 13a4 4 0 0 1-4-4V7.5A1.5 1.5 0 0 1 4.5 6H7V4zm0 4H5v1a2 2 0 0 0 2 2V8zm10 0v3a2 2 0 0 0 2-2V8h-2z" />
    </svg>
  );
}
