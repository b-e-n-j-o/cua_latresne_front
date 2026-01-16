import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

interface DrawerContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction?: "top" | "bottom" | "left" | "right";
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawer() {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error("Drawer components must be used within Drawer");
  }
  return context;
}

interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  direction?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

function Drawer({
  open: controlledOpen,
  onOpenChange,
  direction = "bottom",
  children,
}: DrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen;

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <DrawerContext.Provider value={{ open, onOpenChange: setOpen, direction }}>
      <div data-slot="drawer">{children}</div>
    </DrawerContext.Provider>
  );
}

interface DrawerTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function DrawerTrigger({
  asChild,
  children,
  onClick,
  ...props
}: DrawerTriggerProps) {
  const { onOpenChange } = useDrawer();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        onOpenChange(true);
        (children.props as any)?.onClick?.(e);
        onClick?.(e);
      },
      ...props,
    } as any);
  }

  return (
    <button
      data-slot="drawer-trigger"
      onClick={(e) => {
        onOpenChange(true);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function DrawerPortal({ children }: { children: React.ReactNode }) {
  return typeof window !== "undefined" ? createPortal(children, document.body) : null;
}

function DrawerClose({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useDrawer();

  return (
    <button
      data-slot="drawer-close"
      onClick={(e) => {
        onOpenChange(false);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function DrawerOverlay({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, onOpenChange } = useDrawer();

  if (!open) return null;

  return (
    <DrawerPortal>
      <div
        data-slot="drawer-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-black/50 animate-in fade-in-0",
          className
        )}
        onClick={() => onOpenChange(false)}
        {...props}
      />
    </DrawerPortal>
  );
}

interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "top" | "bottom" | "left" | "right";
}

function DrawerContent({
  className,
  children,
  direction: contentDirection,
  ...props
}: DrawerContentProps) {
  const { open, onOpenChange, direction: contextDirection } = useDrawer();
  const direction = contentDirection || contextDirection || "bottom";

  if (!open) return null;

  const directionClasses = {
    top: "inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-lg border-b",
    bottom: "inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t",
    right: "inset-y-0 right-0 w-3/4 border-l sm:max-w-sm",
    left: "inset-y-0 left-0 w-3/4 border-r sm:max-w-sm",
  };

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <div
        data-slot="drawer-content"
        data-vaul-drawer-direction={direction}
        className={cn(
          "group/drawer-content bg-background fixed z-50 flex h-auto flex-col",
          directionClasses[direction],
          className
        )}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </div>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
