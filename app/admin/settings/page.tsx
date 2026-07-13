import { prisma } from "@/lib/prisma";
import { getMaxLeadRecipients, getLeadExpiryHours } from "@/lib/domain/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { LandTypesManager } from "@/components/admin/land-types-manager";
import { AppearancePicker } from "@/components/admin/appearance-picker";

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
  const [maxLeadRecipients, leadExpiryHours, categories, landTypes] = await Promise.all([
    getMaxLeadRecipients(prisma),
    getLeadExpiryHours(prisma),
    prisma.contractorType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        icon: true,
        _count: { select: { contractors: true, projectTypes: true } },
      },
    }),
    prisma.landType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { leads: true } } },
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
          <div style={cardStyle}>
            <p style={titleStyle}>Lead distribution</p>
            <p style={descStyle}>How leads are shared and how long they stay open.</p>
            <SettingsForm maxLeadRecipients={maxLeadRecipients} leadExpiryHours={leadExpiryHours} />
          </div>

          <div style={cardStyle}>
            <p style={titleStyle}>Appearance</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>Choose how the admin panel looks.</p>
            <AppearancePicker />
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
                leads: t._count.leads,
              }))}
            />
          </div>
        </div>

        <div style={cardStyle}>
          <p style={titleStyle}>Project types</p>
          <p style={{ ...descStyle, marginBottom: 18 }}>
            Services contractors sell and leads request. Rename anytime; delete only when unused.
            Adding a type also creates pricing tiers you can edit under Pricing.
          </p>
          <CategoriesManager
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              icon: c.icon,
              contractors: c._count.contractors,
              projectTypes: c._count.projectTypes,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
