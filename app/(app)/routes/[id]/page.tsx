import type { Metadata } from "next";
import { RouteDetailView } from "@/components/routes/route-detail-view";

export const metadata: Metadata = {
  title: "路线详情",
};

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RouteDetailView routeId={id} />;
}
