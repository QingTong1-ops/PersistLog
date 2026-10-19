import type { Metadata } from "next";
import { RoutesView } from "@/components/routes/routes-view";

export const metadata: Metadata = {
  title: "学习路线",
};

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  return <RoutesView demoState={state} />;
}
