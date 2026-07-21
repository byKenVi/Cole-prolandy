import { Badge } from "@/components/ui/badge";

export function TierBadge({ tier }: { tier: number }) {
  return <Badge variant="neutral">Tier {tier}</Badge>;
}
