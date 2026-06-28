import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageCircle, Calendar, Filter, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/useUnreadCount";

type Item = { to: string; label: string; icon: LucideIcon; badge?: number };

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadCount();
  const items: Item[] = [
    { to: "/app", label: "Início", icon: Home },
    { to: "/app/conversas", label: "Conversas", icon: MessageCircle, badge: unread },
    { to: "/app/agenda", label: "Agenda", icon: Calendar },
    { to: "/app/funil", label: "Funil", icon: Filter },
    { to: "/app/pacientes", label: "Pacientes", icon: Users },
  ];


  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-safe"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 px-2 pt-2">
        {items.map((it) => {
          const active =
            it.to === "/app" ? pathname === "/app" : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className="flex flex-col items-center justify-center gap-1 py-1.5 min-h-[56px] rounded-2xl transition-colors"
              >
                <span
                  className={cn(
                    "relative flex items-center justify-center h-9 w-12 rounded-full transition-all duration-200",
                    active ? "bg-primary/15" : "bg-transparent",
                  )}
                >
                  <Icon
                    strokeWidth={1.5}
                    className={cn(
                      "h-[22px] w-[22px] transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {it.badge ? (
                    <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center">
                      {it.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-caption",
                    active ? "text-primary font-medium" : "text-muted-foreground",
                  )}
                >
                  {it.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
