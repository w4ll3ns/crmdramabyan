import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { ReactNode } from "react";

export function BottomSheet({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title?: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent className="rounded-t-3xl border-t border-border bg-card">
        {(title || description) && (
          <DrawerHeader className="text-left px-6 pt-2">
            {title ? <DrawerTitle className="text-h2">{title}</DrawerTitle> : null}
            {description ? (
              <DrawerDescription className="text-caption text-muted-foreground">
                {description}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>
        )}
        <div className="px-6 pb-8 pt-2">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
