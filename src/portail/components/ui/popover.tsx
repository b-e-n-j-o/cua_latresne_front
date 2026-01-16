import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopover() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within Popover");
  }
  return context;
}

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen;

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const content = document.querySelector('[data-slot="popover-content"]');
      if (content && !content.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange: setOpen }}>
      <div data-slot="popover">{children}</div>
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function PopoverTrigger({
  asChild,
  children,
  onClick,
  ...props
}: PopoverTriggerProps) {
  const { onOpenChange } = usePopover();

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
      data-slot="popover-trigger"
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

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: PopoverContentProps) {
  const { open } = usePopover();

  if (!open) return null;

  return typeof window !== "undefined"
    ? createPortal(
        <div
          data-slot="popover-content"
          className={cn(
            "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 z-50 w-72 rounded-md border p-4 shadow-md outline-hidden",
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

function PopoverAnchor({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="popover-anchor" {...props}>
      {children}
    </div>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
