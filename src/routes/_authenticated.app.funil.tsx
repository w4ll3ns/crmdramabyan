import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/brand/EmptyState";
import { Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/funil")({
  component: () => (
    <div className="pt-10">
      <EmptyState
        icon={<Filter className="h-7 w-7" strokeWidth={1.5} />}
        title="Funil"
        description="Kanban de leads em breve."
      />
    </div>
  ),
});
