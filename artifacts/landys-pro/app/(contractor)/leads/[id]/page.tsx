import { redirect } from "next/navigation";

export default async function LeadDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
