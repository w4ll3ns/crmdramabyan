import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppShell({
  children,
  fab,
  headerRight,
  title,
  subtitle,
}: {
  children: ReactNode;
  fab?: ReactNode;
  headerRight?: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <AppHeader title={title} subtitle={subtitle} right={headerRight} />
      <main className="flex-1 pb-[96px]">{children}</main>
      {fab ? (
        <div className="fixed right-5 bottom-[88px] z-40 mb-safe">{fab}</div>
      ) : null}
      <BottomNav />
    </div>
  );
}
