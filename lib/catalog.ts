/**
 * Canonical marketplace catalog (projects + land types).
 * Seed and sync scripts read from here. Admins can still rename/add via Settings.
 *
 * Hierarchy is exactly two levels:
 *   Project (job the landowner wants) → Tier 1/2/3 (scale / lead price)
 * There is no nested "project type inside a project type."
 */

export const LAND_TYPES = [
  "Development",
  "Farmland",
  "Timberland",
  "Ranching",
  "Homestead",
  "Hunting",
] as const;

/**
 * Default tier prices in dollars [T1, T2, T3] when seeding a new project.
 * Anchors from client: small culvert ≈ $40; large pond ≈ $200.
 */
export const DEFAULT_PROJECT_PRICES: [number, number, number] = [50, 95, 150];

export type CatalogEntry = {
  /** Project display name (contractor category is 1:1 with the lead project). */
  name: string;
  /** Icon key under /public/icons (or "auto"). */
  icon: string;
  /** Optional override of default tier prices (dollars). */
  prices?: [number, number, number];
};

/**
 * Client projects — each is a contractor category with exactly one selectable
 * ProjectType of the same name and exactly three PriceTiers.
 */
export const PROJECT_CATALOG: readonly CatalogEntry[] = [
  { name: "Culvert Install", icon: "drainage", prices: [40, 75, 110] },
  { name: "Barndominium Building", icon: "grading", prices: [100, 160, 220] },
  { name: "Brush Hogging", icon: "brush-mowing", prices: [40, 70, 110] },
  { name: "Pond Building", icon: "pond", prices: [90, 140, 200] },
  { name: "Cabin Construction", icon: "grading", prices: [100, 160, 220] },
  { name: "Driveway Construction", icon: "road", prices: [50, 95, 150] },
  { name: "Water Well Drilling", icon: "well-drilling", prices: [80, 130, 200] },
  { name: "Gated Entrance", icon: "fencing", prices: [45, 80, 130] },
  { name: "Drainage Improvement", icon: "drainage", prices: [45, 85, 140] },
  { name: "Irrigation System Installation", icon: "drainage", prices: [55, 100, 160] },
  { name: "Retaining Wall Construction", icon: "grading", prices: [70, 120, 185] },
  { name: "Utility Trenching", icon: "excavation", prices: [45, 85, 140] },
  { name: "Tree Removal & Stump Grinding", icon: "tree-service", prices: [50, 95, 150] },
  { name: "Land Grading & Leveling", icon: "grading", prices: [50, 95, 150] },
] as const;
