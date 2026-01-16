import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

interface TooltipContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltip() {
  const context = React.useContext(TooltipContext);
  if (!context) {
    throw new Error("Tooltip components must be used within Tooltip");
  }
  return context;
}

interface TooltipProviderProps {
  delayDuration?: number;
  children: React.ReactNode;
}

function TooltipProvider({
  delayDuration = 0,
  children,
}: TooltipProviderProps) {
  return (
    <div data-slot="tooltip-provider" data-delay-duration={delayDuration}>
      {children}
    </div>
  );
}

interface TooltipProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Tooltip({
  open: controlledOpen,
  onOpenChange,
  children,
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen;

  return (
    <TooltipContext.Provider value={{ open, onOpenChange: setOpen }}>
      <div data-slot="tooltip">{children}</div>
    </TooltipContext.Provider>
  );
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

function TooltipTrigger({
  asChild,
  children,
  onMouseEnter,
  onMouseLeave,
  ...props
}: TooltipTriggerProps) {
  const { onOpenChange } = useTooltip();

  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as any;
    return React.cloneElement(children, {
      onMouseEnter: (e: React.MouseEvent) => {
        onOpenChange(true);
        childProps?.onMouseEnter?.(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        onOpenChange(false);
        childProps?.onMouseLeave?.(e);
      },
      ...props,
    } as any);
  }

  return (
    <span
      data-slot="tooltip-trigger"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </span>
  );
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
}

function TooltipContent({
  className,
  sideOffset = 0,
  side = "top",
  children,
  ...props
}: TooltipContentProps) {
  const { open } = useTooltip();

  if (!open) return null;

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return typeof window !== "undefined"
    ? createPortal(
        <div
          data-slot="tooltip-content"
          className={cn(
            "bg-foreground text-background animate-in fade-in-0 zoom-in-95 z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance fixed",
            positionClasses[side],
            className
          )}
          style={{ marginTop: side === "bottom" ? sideOffset : undefined }}
          {...props}
        >
          {children}
        </div>,
        document.body
      )
    : null;
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
