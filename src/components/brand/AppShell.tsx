import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppShell({
  children,
  fab,
  headerRight,
  title,
  subtitle,
  hideHeader = false,
  hideNav = false,
}: {
  children: ReactNode;
  fab?: ReactNode;
  headerRight?: ReactNode;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
  hideNav?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {hideHeader ? null : (
        <AppHeader title={title} subtitle={subtitle} right={headerRight} />
      )}
      <main className={hideNav ? "flex-1" : "flex-1 pb-[96px]"}>{children}</main>
      {fab && !hideNav ? (
        <div className="fixed right-5 bottom-[88px] z-40 mb-safe">{fab}</div>
      ) : null}
      {hideNav ? null : <BottomNav />}
    </div>
  );
}
