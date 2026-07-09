/**
 * Maps a contractor category / project type to its 3D icon.
 *
 * Categories are admin-editable, so we match on keywords (case-insensitive)
 * against the combined category + project-type name rather than an exact slug.
 * Returns the icon path, or null when nothing matches (caller renders a
 * neutral fallback).
 */
const ICON_RULES: { keywords: string[]; src: string }[] = [
  { keywords: ["excavation", "dirt", "dig", "trench"], src: "/icons/excavation.png" },
  { keywords: ["land clearing", "clearing", "mulch"], src: "/icons/land-clearing.png" },
  { keywords: ["pond", "dam", "levee", "dredg"], src: "/icons/pond.png" },
  { keywords: ["fenc", "gate"], src: "/icons/fencing.png" },
  { keywords: ["survey", "boundary", "plat", "topograph"], src: "/icons/surveying.png" },
  { keywords: ["tree", "stump"], src: "/icons/tree-service.png" },
  { keywords: ["road", "driveway", "gravel"], src: "/icons/road.png" },
  { keywords: ["drain", "culvert", "french"], src: "/icons/drainage.png" },
  { keywords: ["brush", "mow", "pasture", "forestry"], src: "/icons/brush-mowing.png" },
  { keywords: ["septic", "perc"], src: "/icons/septic.png" },
  { keywords: ["grad", "pad ", "level"], src: "/icons/grading.png" },
  { keywords: ["well", "drill", "pump"], src: "/icons/well-drilling.png" },
];

export function projectIconSrc(...parts: (string | null | undefined)[]): string | null {
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return null;
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.src;
  }
  return null;
}

/**
 * The icon keys an admin can assign to a category. A key is the base filename
 * (no extension) of a file in /public/icons.
 */
export const ICON_KEYS = [
  "excavation",
  "land-clearing",
  "pond",
  "fencing",
  "surveying",
  "tree-service",
  "road",
  "drainage",
  "brush-mowing",
  "septic",
  "grading",
  "well-drilling",
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

/** Human-friendly labels for the icon picker. */
export const ICON_LABELS: Record<IconKey, string> = {
  excavation: "Excavation",
  "land-clearing": "Land Clearing",
  pond: "Pond",
  fencing: "Fencing",
  surveying: "Surveying",
  "tree-service": "Tree Service",
  road: "Road / Driveway",
  drainage: "Drainage",
  "brush-mowing": "Brush Mowing",
  septic: "Septic",
  grading: "Grading",
  "well-drilling": "Well Drilling",
};

/** Sentinel values stored in `ContractorType.icon` that are NOT icon keys. */
export const ICON_AUTO = "auto";
export const ICON_NONE = "none";

function isIconKey(value: string): value is IconKey {
  return (ICON_KEYS as readonly string[]).includes(value);
}

/** The `/public/icons` path for a given icon key. */
export function iconSrcForKey(key: IconKey): string {
  return `/icons/${key}.png`;
}

/**
 * Resolves the 3D icon for a category, honouring an admin's explicit choice.
 *
 * Precedence:
 *   1. explicit icon key (admin-assigned) → that icon
 *   2. "none"                             → null (neutral fallback glyph)
 *   3. null / "auto" / unknown key        → keyword match on category/project
 *   4. no keyword match                   → null (neutral fallback glyph)
 */
export function iconSrcFor({
  icon,
  category,
  project,
}: {
  icon?: string | null;
  category?: string | null;
  project?: string | null;
}): string | null {
  if (icon === ICON_NONE) return null;
  if (icon && icon !== ICON_AUTO && isIconKey(icon)) return iconSrcForKey(icon);
  return projectIconSrc(category, project);
}
