import {
  Axe,
  Construction,
  Cylinder,
  Drill,
  Droplets,
  Fence,
  Hammer,
  House,
  LandPlot,
  Route,
  Shovel,
  Tractor,
  TreePine,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * Line icon for a kind of land work. Callers still pass the historical
 * "/icons/<key>.png" path (or the bare key) produced by lib/project-icons, so
 * the matching rules live in one place; this only decides how a key is drawn.
 */
const GLYPHS: Record<string, LucideIcon> = {
  excavation: Shovel,
  "land-clearing": Axe,
  pond: Waves,
  fencing: Fence,
  surveying: LandPlot,
  "tree-service": TreePine,
  road: Route,
  drainage: Droplets,
  "brush-mowing": Tractor,
  septic: Cylinder,
  grading: Construction,
  "well-drilling": Drill,
  building: House,
  fallback: Hammer,
};

export function glyphKey(srcOrKey: string | null | undefined): string {
  if (!srcOrKey) return "fallback";
  const base = srcOrKey.split("/").pop()?.replace(/\.png$/, "") ?? "";
  return base in GLYPHS ? base : "fallback";
}

export function ProjectGlyph({
  src,
  size = 20,
  strokeWidth = 1.8,
}: {
  /** "/icons/pond.png" or "pond". */
  src: string | null | undefined;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = GLYPHS[glyphKey(src)] ?? Hammer;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
