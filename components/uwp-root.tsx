"use client";

import { ThemeRoot } from "uwp_components";
import type { ReactNode } from "react";

export function UwpRoot({ children }: { children: ReactNode }) {
  return (
    <ThemeRoot
      theme={{ era: "win10", colorScheme: "light", density: "compact" }}
      className="app win10 compact"
    >
      {children}
    </ThemeRoot>
  );
}
