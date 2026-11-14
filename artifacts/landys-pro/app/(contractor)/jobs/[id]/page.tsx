import { MatchDetail } from "@/components/pro/match-detail";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetail id={id} />;
}
