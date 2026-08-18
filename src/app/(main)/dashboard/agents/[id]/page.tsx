import { notFound, redirect } from "next/navigation";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  redirect(`/dashboard/agents/${id}/overview`);
}
