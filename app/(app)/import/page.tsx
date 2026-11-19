import type { Metadata } from "next";
import { ImportView } from "@/components/import/import-view";

export const metadata: Metadata = {
  title: "导入计划",
};

export default function ImportPage() {
  return <ImportView />;
}
