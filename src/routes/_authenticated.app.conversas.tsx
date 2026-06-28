import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/brand/EmptyState";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/conversas")({
  component: () => (
    <div className="pt-10">
      <EmptyState
        icon={<MessageCircle className="h-7 w-7" strokeWidth={1.5} />}
        title="Conversas"
        description="Em breve você verá aqui o WhatsApp das pacientes."
      />
    </div>
  ),
});
