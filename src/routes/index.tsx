import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = auth.getSession();
    throw redirect({ to: s ? "/app" : "/auth" });
  },
  component: () => null,
});
