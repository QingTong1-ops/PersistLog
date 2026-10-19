import type { Metadata } from "next";
import { ImportView } from "@/components/import/import-view";

export const metadata: Metadata = {
  title: "导入计划",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  return <ImportView demoState={state} />;
}
