import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

interface HoverCardContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(null);

function useHoverCard() {
  const context = React.useContext(HoverCardContext);
  if (!context) {
    throw new Error("HoverCard components must be used within HoverCard");
  }
  return context;
}

interface HoverCardProps {
  openDelay?: number;
  closeDelay?: number;
  children: React.ReactNode;
}

function HoverCard({
  openDelay = 700,
  closeDelay = 300,
  children,
}: HoverCardProps) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), openDelay);
  };

  const handleClose = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), closeDelay);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <HoverCardContext.Provider value={{ open, onOpenChange: setOpen }}>
      <div
        data-slot="hover-card"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
      >
        {children}
      </div>
    </HoverCardContext.Provider>
  );
}

interface HoverCardTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

function HoverCardTrigger({
  asChild,
  children,
  ...props
}: HoverCardTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return <>{children}</>;
  }
  return (
    <div data-slot="hover-card-trigger" {...props}>
      {children}
    </div>
  );
}

interface HoverCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: HoverCardContentProps) {
  const { open } = useHoverCard();

  if (!open) return null;

  return typeof window !== "undefined"
    ? createPortal(
        <div
          data-slot="hover-card-content"
          className={cn(
            "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 z-50 w-64 rounded-md border p-4 shadow-md outline-hidden",
            className
          )}
          style={{ marginTop: `${sideOffset}px` }}
          {...props}
        >
          {children}
        </div>,
        document.body
      )
    : null;
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
