import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getLeadExpiryHours,
  getMaxLeadPurchases,
} from "@/lib/domain/settings";
import { getSession } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/settings-form";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { LandTypesManager } from "@/components/admin/land-types-manager";
import { AppearancePicker } from "@/components/admin/appearance-picker";
import { ContractorCategoriesManager } from "@/components/admin/contractor-categories-manager";

export const dynamic = "force-dynamic";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 18,
  boxShadow: "var(--shadow)",
  padding: "24px 26px",
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 4px",
  font: "600 17px/1 'Inter'",
  color: "var(--ink)",
};
const descStyle: React.CSSProperties = {
  margin: "0 0 22px",
  color: "var(--ink2)",
  fontSize: 14,
};

export default async function SettingsPage() {
  const [
    session,
    maxLeadPurchases,
    leadExpiryHours,
    projects,
    landTypes,
    contractorCategories,
  ] =
    await Promise.all([
    getSession(),
    getMaxLeadPurchases(prisma),
    getLeadExpiryHours(prisma),
    prisma.contractorType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        icon: true,
        _count: { select: { contractors: true } },
        projectType: {
          select: {
            code: true,
            archivedAt: true,
            _count: { select: { leads: true } },
          },
        },
      },
    }),
    prisma.landType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        archivedAt: true,
        _count: { select: { leads: true } },
      },
    }),
    prisma.contractorCategory.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        archivedAt: true,
        _count: { select: { contractors: true, leads: true } },
      },
    }),
    ]);

  return (
    <div className="admin-fade-up">
      <h1
        className="font-fraunces"
        style={{
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "-.01em",
          margin: "0 0 24px",
          color: "var(--ink)",
        }}
      >
        Settings
      </h1>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}
        className="admin-grid-stack"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {session.adminRole === "owner" && (
            <Link href="/admin/team" style={{ textDecoration: "none" }}>
              <div
                className="settings-team-card"
                style={{
                  ...cardStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  cursor: "pointer",
                }}
              >
                <div>
                  <p style={titleStyle}>Team</p>
                  <p style={{ ...descStyle, marginBottom: 0 }}>
                    Invite admins, manage roles, and control who has access to this dashboard.
                  </p>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          )}

          <div style={cardStyle}>
            <p style={titleStyle}>Lead distribution</p>
            <p style={descStyle}>How leads are shared and how long they stay open.</p>
            <SettingsForm
              maxLeadPurchases={maxLeadPurchases}
              leadExpiryHours={leadExpiryHours}
            />
          </div>

          <div style={cardStyle}>
            <p style={titleStyle}>Appearance</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>Choose how the admin panel looks.</p>
            <AppearancePicker />
          </div>

          <div style={cardStyle}>
            <p style={titleStyle}>Contractor categories</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              One business category per contractor. Categories do not determine project-service
              eligibility.
            </p>
            <ContractorCategoriesManager
              categories={contractorCategories.map((category) => ({
                id: category.id,
                name: category.name,
                code: category.code,
                archived: Boolean(category.archivedAt),
                contractors: category._count.contractors,
                leads: category._count.leads,
              }))}
            />
          </div>

          <div style={cardStyle}>
            <p style={titleStyle}>Land types</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              Property classifications for leads. Renaming is safe; delete only when no leads use the
              type.
            </p>
            <LandTypesManager
              landTypes={landTypes.map((t) => ({
                id: t.id,
                name: t.name,
                code: t.code,
                archived: Boolean(t.archivedAt),
                leads: t._count.leads,
              }))}
            />
          </div>

        </div>

        <div style={cardStyle}>
          <p style={titleStyle}>Projects</p>
          <p style={{ ...descStyle, marginBottom: 18 }}>
            Jobs landowners request and contractors fulfill. Hierarchy is{" "}
            <b style={{ color: "var(--ink)" }}>Project → 3 tiers</b> (small / medium / large lead
            prices). Enter all three prices when creating a project; edit them later under Pricing.
            Rename anytime and delete only when unused.
          </p>
          <CategoriesManager
            categories={projects.map((c) => ({
              id: c.id,
              name: c.name,
              icon: c.icon,
              code: c.projectType?.code ?? "",
              archived: Boolean(c.projectType?.archivedAt),
              contractors: c._count.contractors,
              leads: c.projectType?._count.leads ?? 0,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
