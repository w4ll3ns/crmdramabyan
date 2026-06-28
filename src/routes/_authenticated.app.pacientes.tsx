import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, LogOut } from "lucide-react";
import { EmptyState } from "@/components/brand/EmptyState";
import { signOut } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/pacientes")({
  component: PacientesPage,
});

function PacientesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="pt-10">
      <EmptyState
        icon={<Users className="h-7 w-7" strokeWidth={1.5} />}
        title="Pacientes"
        description="Lista e prontuários virão a seguir."
        action={
          <button
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-label text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Sair
          </button>
        }
      />
    </div>
  );
}
