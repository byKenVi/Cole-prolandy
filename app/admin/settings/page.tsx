import { prisma } from "@/lib/prisma";
import { getMaxLeadRecipients, getLeadExpiryHours } from "@/lib/domain/settings";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [maxLeadRecipients, leadExpiryHours, categories] = await Promise.all([
    getMaxLeadRecipients(prisma),
    getLeadExpiryHours(prisma),
    prisma.contractorType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { contractors: true, projectTypes: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold text-text">Settings</h1>
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Lead distribution</CardTitle>
          <CardDescription>
            These control how leads are shared and how long they stay open.
          </CardDescription>
        </CardHeader>
        <SettingsForm
          maxLeadRecipients={maxLeadRecipients}
          leadExpiryHours={leadExpiryHours}
        />
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Contractor categories</CardTitle>
          <CardDescription>
            The trades contractors and leads are grouped by. Renaming is safe. A category can only be
            deleted once no contractors or project types reference it, so pricing and leads stay
            consistent.
          </CardDescription>
        </CardHeader>
        <CategoriesManager
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            contractors: c._count.contractors,
            projectTypes: c._count.projectTypes,
          }))}
        />
      </Card>
    </div>
  );
}
