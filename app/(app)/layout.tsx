import { AppShell } from "@/components/app-shell";
import { SessionGate } from "@/components/auth/session-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
