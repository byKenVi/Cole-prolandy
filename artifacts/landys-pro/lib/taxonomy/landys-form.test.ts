import { describe, expect, it } from "vitest";
import {
  LANDYS_BUDGETS,
  LANDYS_PROJECTS,
  LANDYS_TIMELINES,
  categoryCandidatesForProject,
} from "./landys-form";
import { normalizeLiveBudgetBand, normalizeLiveTimelineCode } from "./live-v3";
import { slugifyTaxonomy } from "@/lib/services/taxonomy-registry";

describe("landys.co form taxonomy", () => {
  it("knows a category for every project on the site", () => {
    const missing = LANDYS_PROJECTS.filter((project) => categoryCandidatesForProject(project).length === 0);
    expect(missing).toEqual([]);
  });

  it("reads projects by label or by slug", () => {
    expect(categoryCandidatesForProject("Pond Building")[0]).toBe("Dirt Work & Excavation");
    expect(categoryCandidatesForProject("property-line-staking-marking")[0]).toBe("Surveyors");
    expect(categoryCandidatesForProject(slugifyTaxonomy("Title / Alta Survey"))[0]).toBe("Surveyors");
    expect(categoryCandidatesForProject("Something new")).toEqual([]);
  });

  it("sends budget and timeline values the intake understands", () => {
    for (const budget of LANDYS_BUDGETS) expect(normalizeLiveBudgetBand(budget.value)).not.toBeNull();
    for (const timeline of LANDYS_TIMELINES) expect(normalizeLiveTimelineCode(timeline.value)).toBe(timeline.value);
  });

  it("lists every project once", () => {
    expect(new Set(LANDYS_PROJECTS).size).toBe(LANDYS_PROJECTS.length);
  });
});
