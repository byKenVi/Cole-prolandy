/**
 * Canonical marketplace catalog (project categories + land types).
 * Seed and sync scripts read from here. Admins can still rename/add via Settings.
 */

export const LAND_TYPES = [
  "Development",
  "Farmland",
  "Timberland",
  "Ranching",
  "Homestead",
  "Hunting",
] as const;

/** Default tier prices in dollars [T1, T2, T3] when seeding a project type. */
export const DEFAULT_PROJECT_PRICES: [number, number, number] = [75, 135, 220];

export type CatalogEntry = {
  /** ContractorType + ProjectType display name (1:1 for this catalog). */
  name: string;
  /** Icon key under /public/icons (or "auto"). */
  icon: string;
  /** Optional override of default tier prices (dollars). */
  prices?: [number, number, number];
};

/**
 * Client project types — each is a contractor category with one selectable project
 * of the same name (keeps matching + pricing matrix working).
 */
export const PROJECT_CATALOG: readonly CatalogEntry[] = [
  { name: "Culvert Install", icon: "drainage", prices: [60, 110, 180] },
  { name: "Barndominium Building", icon: "grading", prices: [150, 250, 400] },
  { name: "Brush Hogging", icon: "brush-mowing", prices: [40, 75, 120] },
  { name: "Pond Building", icon: "pond", prices: [120, 200, 300] },
  { name: "Cabin Construction", icon: "grading", prices: [150, 250, 400] },
  { name: "Driveway Construction", icon: "road", prices: [70, 130, 210] },
  { name: "Water Well Drilling", icon: "well-drilling", prices: [120, 200, 300] },
  { name: "Gated Entrance", icon: "fencing", prices: [50, 90, 150] },
  { name: "Drainage Improvement", icon: "drainage", prices: [60, 110, 180] },
  { name: "Irrigation System Installation", icon: "drainage", prices: [80, 140, 220] },
  { name: "Retaining Wall Construction", icon: "grading", prices: [90, 160, 250] },
  { name: "Utility Trenching", icon: "excavation", prices: [50, 90, 150] },
  { name: "Tree Removal & Stump Grinding", icon: "tree-service", prices: [60, 110, 180] },
  { name: "Land Grading & Leveling", icon: "grading", prices: [70, 130, 210] },
] as const;
