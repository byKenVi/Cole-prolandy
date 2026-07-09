import { prisma } from "@/lib/prisma";
import { getMaxLeadRecipients, getLeadExpiryHours } from "@/lib/domain/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { CategoriesManager } from "@/components/admin/categories-manager";
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
  const [maxLeadRecipients, leadExpiryHours, categories] = await Promise.all([
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={cardStyle}>
          <p style={titleStyle}>Lead distribution</p>
          <p style={descStyle}>How leads are shared and how long they stay open.</p>
          <SettingsForm maxLeadRecipients={maxLeadRecipients} leadExpiryHours={leadExpiryHours} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <p style={titleStyle}>Appearance</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>Choose how the admin panel looks.</p>
            <AppearancePicker />
          </div>

          <div style={cardStyle}>
            <p style={titleStyle}>Contractor categories</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              The trades contractors and leads are grouped by. Renaming is safe; a category can only
              be deleted once no contractors or project types reference it.
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
    </div>
  );
}
