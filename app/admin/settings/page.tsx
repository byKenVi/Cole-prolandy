import { prisma } from "@/lib/prisma";
import { getMaxLeadRecipients, getLeadExpiryHours } from "@/lib/domain/settings";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [maxLeadRecipients, leadExpiryHours] = await Promise.all([
    getMaxLeadRecipients(prisma),
    getLeadExpiryHours(prisma),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Settings</h1>
      <Card>
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
    </div>
  );
}
