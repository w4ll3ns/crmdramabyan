import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/brand/AppShell";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Conversa detalhe ocupa tela cheia (sem header padrão + sem bottom nav)
  const fullScreen = /^\/app\/conversas\/[^/]+$/.test(pathname);
  return (
    <AppShell hideHeader={fullScreen} hideNav={fullScreen}>
      <Outlet />
    </AppShell>
  );
}
