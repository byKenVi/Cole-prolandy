import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Panel, PageHeader } from "@/components/admin/ui";
import { ManualLeadForm } from "@/components/admin/manual-lead-form";
import { countyOptions } from "@/lib/geo/zip";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  // landys.co serves Texas: same county list as the site's form.
  const counties = await countyOptions("TX");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/leads"
        className="flex items-center gap-1 text-sm"
        style={{ color: "var(--ink2)", width: "fit-content" }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      <PageHeader
        title="New request"
        subtitle="The same questions as the landys.co estimate form. Use it for requests taken by phone or email: they are routed exactly like the ones from the site."
      />

      <Panel style={{ padding: "28px 28px 32px" }}>
        <ManualLeadForm counties={counties} />
      </Panel>
    </div>
  );
}
