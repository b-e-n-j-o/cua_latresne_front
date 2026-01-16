import * as React from "react";
import { cn } from "../../lib/utils";

type ToggleVariant = "default" | "outline";
type ToggleSize = "default" | "sm" | "lg";

const toggleVariantsClasses: Record<ToggleVariant, string> = {
  default: "bg-transparent",
  outline:
    "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
};

const toggleSizeClasses: Record<ToggleSize, string> = {
  default: "h-9 px-2 min-w-9",
  sm: "h-8 px-1.5 min-w-8",
  lg: "h-10 px-2.5 min-w-10",
};

const toggleBaseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap";

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ToggleVariant;
  size?: ToggleSize;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

function Toggle({
  className,
  variant = "default",
  size = "default",
  pressed,
  onPressedChange,
  onClick,
  ...props
}: ToggleProps) {
  const [internalPressed, setInternalPressed] = React.useState(false);
  const isControlled = pressed !== undefined;
  const isPressed = isControlled ? pressed : internalPressed;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isControlled) {
      onPressedChange?.(!pressed);
    } else {
      setInternalPressed(!internalPressed);
    }
    onClick?.(e);
  };

  return (
    <button
      data-slot="toggle"
      data-state={isPressed ? "on" : "off"}
      onClick={handleClick}
      className={cn(
        toggleBaseClasses,
        toggleVariantsClasses[variant],
        toggleSizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

function toggleVariants(options?: { variant?: ToggleVariant; size?: ToggleSize; className?: string }) {
  const variant = options?.variant || "default";
  const size = options?.size || "default";
  return cn(
    toggleBaseClasses,
    toggleVariantsClasses[variant],
    toggleSizeClasses[size],
    options?.className
  );
}

export { Toggle, toggleVariants };
