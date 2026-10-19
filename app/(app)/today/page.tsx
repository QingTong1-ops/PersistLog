import type { Metadata } from "next";
import { TodayView } from "@/components/today/today-view";

export const metadata: Metadata = {
  title: "今日",
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  return <TodayView demoState={state} />;
}
