import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!auth.getSession()) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
