/**
 * The "Get Three Estimates" form on landys.co, as it is live (checked on
 * 2026-11-17). The admin "New request" form uses these exact questions and
 * choices, and the bootstrap seeds them so the catalog matches the site.
 *
 * landys.co fills its land type, county and project lists from its own CMS;
 * if the client adds a project there, add it here too (intake also creates
 * unknown projects on first sight, so nothing is ever rejected).
 */

/** Land type pills, in the site's order. */
export const LANDYS_LAND_TYPES = [
  "Homestead",
  "Ranching",
  "Timberland",
  "Farmland",
  "Development",
  "Hunting",
  "Other",
] as const;

/** "Popular projects" block, shown first in the project picker. */
export const LANDYS_POPULAR_PROJECTS = [
  "Barndominium Building",
  "Brush Hogging",
  "Custom Home Building",
  "Fence Building",
  "Forestry Mulching",
  "Land Clearing",
  "Pond Building",
  "Property Line Staking & Marking",
  "Road Building",
  "Septic System Installation",
  "Water Well Drilling",
] as const;

/** "All projects & categories" block, in the site's (alphabetical) order. */
export const LANDYS_OTHER_PROJECTS = [
  "Aerobic Septic Maintenance",
  "Aerobic Septic System Installation",
  "Automatic Gate Installation",
  "Barbed Wire Fence",
  "Barn Building",
  "Boundary Survey",
  "Brush Clearing",
  "Builders",
  "Cabin Building",
  "Cattle Guard Installation",
  "Construction Staking",
  "Conventional Septic System Installation",
  "Cross Fencing",
  "Culvert Installation",
  "Debris Removal",
  "Demolition",
  "Dirt Work",
  "Dirt Work & Excavation",
  "Drainage Work",
  "Driveway Construction",
  "Easement Survey",
  "Elevation Certificate & Flood Survey",
  "Entrance Building",
  "Excavation",
  "Fence & Gate Repair",
  "Fence Line Clearing",
  "Fencing & Entrances",
  "Field & Net Wire Fence",
  "Game & High Fence",
  "General Contracting",
  "Home Addition",
  "Home Building",
  "Home Remodeling",
  "Homesite Clearing",
  "House Pad Building",
  "Hunting Land Setup",
  "Land Development",
  "Land Division Survey",
  "Land Grading",
  "Lot Clearing",
  "Material Hauling",
  "Metal Building Construction",
  "Pasture Clearing & Reclamation",
  "Pipe Fence",
  "Pond Repair & Enlargement",
  "Ranch & Livestock Fence",
  "Ranch Home Building",
  "Right-of-way Clearing",
  "Septic System Inspection",
  "Septic System Repair",
  "Septic Tank Pumping",
  "Shop Building",
  "Site Preparation",
  "Subdivision Platting",
  "Surveyors",
  "Title / Alta Survey",
  "Topographic Survey",
  "Trail Clearing",
  "Underbrush Clearing",
  "Water Well Plugging & Abandonment",
  "Water Well Repair",
  "Water Wells & Septic",
  "Well Pump Repair & Replacement",
] as const;

export const LANDYS_PROJECTS: readonly string[] = [...LANDYS_POPULAR_PROJECTS, ...LANDYS_OTHER_PROJECTS];

/** Budget segments. Values are intake band codes; labels avoid the site's dashes. */
export const LANDYS_BUDGETS = [
  { value: "under-5k", label: "Under $5K" },
  { value: "5k-15k", label: "$5K to $15K" },
  { value: "15k-50k", label: "$15K to $50K" },
  { value: "50k-plus", label: "$50K+" },
] as const;

/** "When should work start?" */
export const LANDYS_TIMELINES = [
  { value: "asap", label: "ASAP" },
  { value: "within-2-weeks", label: "Within 2 weeks" },
  { value: "within-1-month", label: "Within 1 month" },
  { value: "1-3-months", label: "1 to 3 months" },
  { value: "3-plus-months", label: "3+ months" },
  { value: "just-researching", label: "Just researching" },
] as const;

export const LANDYS_URGENCIES = ["Emergency", "High", "Medium", "Low"] as const;

/**
 * Contractor categories of the landys.co directory (home page, "Thousands of
 * land contractors"). A request carries a project, not a category, so the
 * category used for matching is inferred from the project below. Each entry
 * lists the spellings the CMS may use for the same category.
 */
const CATEGORY_SPELLINGS = {
  landClearing: ["Land Clearing"],
  surveyors: ["Surveyors", "Surveying"],
  builders: ["Builders", "Builder"],
  dirtWork: ["Dirt Work & Excavation", "Dirt Work and Excavation", "Excavation"],
  fencing: ["Fencing & Entrances", "Fencing and Entrances", "Fencing"],
  wellSeptic: ["Water Well & Septic", "Water Wells & Septic", "Water Well and Septic"],
  forestry: ["Forestry & Timber", "Forestry and Timber"],
  maintenance: ["Property Maintenance"],
  wildlife: ["Wildlife Management"],
} as const;

type CategoryKey = keyof typeof CATEGORY_SPELLINGS;

const PROJECT_CATEGORY: Record<string, CategoryKey> = {
  "Barndominium Building": "builders",
  "Brush Hogging": "maintenance",
  "Custom Home Building": "builders",
  "Fence Building": "fencing",
  "Forestry Mulching": "landClearing",
  "Land Clearing": "landClearing",
  "Pond Building": "dirtWork",
  "Property Line Staking & Marking": "surveyors",
  "Road Building": "dirtWork",
  "Septic System Installation": "wellSeptic",
  "Water Well Drilling": "wellSeptic",
  "Aerobic Septic Maintenance": "wellSeptic",
  "Aerobic Septic System Installation": "wellSeptic",
  "Automatic Gate Installation": "fencing",
  "Barbed Wire Fence": "fencing",
  "Barn Building": "builders",
  "Boundary Survey": "surveyors",
  "Brush Clearing": "landClearing",
  Builders: "builders",
  "Cabin Building": "builders",
  "Cattle Guard Installation": "fencing",
  "Construction Staking": "surveyors",
  "Conventional Septic System Installation": "wellSeptic",
  "Cross Fencing": "fencing",
  "Culvert Installation": "dirtWork",
  "Debris Removal": "landClearing",
  Demolition: "dirtWork",
  "Dirt Work": "dirtWork",
  "Dirt Work & Excavation": "dirtWork",
  "Drainage Work": "dirtWork",
  "Driveway Construction": "dirtWork",
  "Easement Survey": "surveyors",
  "Elevation Certificate & Flood Survey": "surveyors",
  "Entrance Building": "fencing",
  Excavation: "dirtWork",
  "Fence & Gate Repair": "fencing",
  "Fence Line Clearing": "landClearing",
  "Fencing & Entrances": "fencing",
  "Field & Net Wire Fence": "fencing",
  "Game & High Fence": "fencing",
  "General Contracting": "builders",
  "Home Addition": "builders",
  "Home Building": "builders",
  "Home Remodeling": "builders",
  "Homesite Clearing": "landClearing",
  "House Pad Building": "dirtWork",
  "Hunting Land Setup": "wildlife",
  "Land Development": "dirtWork",
  "Land Division Survey": "surveyors",
  "Land Grading": "dirtWork",
  "Lot Clearing": "landClearing",
  "Material Hauling": "dirtWork",
  "Metal Building Construction": "builders",
  "Pasture Clearing & Reclamation": "landClearing",
  "Pipe Fence": "fencing",
  "Pond Repair & Enlargement": "dirtWork",
  "Ranch & Livestock Fence": "fencing",
  "Ranch Home Building": "builders",
  "Right-of-way Clearing": "landClearing",
  "Septic System Inspection": "wellSeptic",
  "Septic System Repair": "wellSeptic",
  "Septic Tank Pumping": "wellSeptic",
  "Shop Building": "builders",
  "Site Preparation": "dirtWork",
  "Subdivision Platting": "surveyors",
  Surveyors: "surveyors",
  "Title / Alta Survey": "surveyors",
  "Topographic Survey": "surveyors",
  "Trail Clearing": "landClearing",
  "Underbrush Clearing": "landClearing",
  "Water Well Plugging & Abandonment": "wellSeptic",
  "Water Well Repair": "wellSeptic",
  "Water Wells & Septic": "wellSeptic",
  "Well Pump Repair & Replacement": "wellSeptic",
};

/** "Property Line Staking & Marking", "property-line-staking-marking" → same key. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROJECT_LOOKUP = new Map<string, CategoryKey>(
  Object.entries(PROJECT_CATEGORY).map(([project, key]) => [normalize(project), key]),
);

/**
 * Category spellings to try for a project, most likely first. Accepts the
 * project label or its slug ("pond-building"). Empty when the project is
 * unknown: the request is then held for an admin to classify.
 */
export function categoryCandidatesForProject(project: string | null | undefined): string[] {
  if (!project?.trim()) return [];
  const key = PROJECT_LOOKUP.get(normalize(project));
  return key ? [...CATEGORY_SPELLINGS[key]] : [];
}
