import { Badge } from "@/components/ui/badge";

const LEAD_MATCH: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "New", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  DECLINED: { label: "Passed", variant: "neutral" },
  EXPIRED: { label: "Expired", variant: "danger" },
};

const LEAD: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "neutral" }> = {
  NEW: { label: "New", variant: "warning" },
  DISTRIBUTED: { label: "Distributed", variant: "default" },
  EXPIRED: { label: "Expired", variant: "danger" },
  CLOSED: { label: "Closed", variant: "neutral" },
};

export function LeadMatchStatusBadge({ status }: { status: string }) {
  const s = LEAD_MATCH[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const s = LEAD[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
