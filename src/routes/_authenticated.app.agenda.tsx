import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/brand/EmptyState";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: () => (
    <div className="pt-10">
      <EmptyState
        icon={<Calendar className="h-7 w-7" strokeWidth={1.5} />}
        title="Agenda"
        description="Calendário e horários virão na próxima etapa."
      />
    </div>
  ),
});
