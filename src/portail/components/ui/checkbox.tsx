import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "../../lib/utils";

interface CheckboxProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({
  className,
  checked: controlledChecked,
  onCheckedChange,
  onClick,
  ...props
}: CheckboxProps) {
  const [internalChecked, setInternalChecked] = React.useState(false);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const newChecked = !checked;
    if (isControlled) {
      onCheckedChange?.(newChecked);
    } else {
      setInternalChecked(newChecked);
    }
    onClick?.(e);
  };

  return (
    <button
      data-slot="checkbox"
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      onClick={handleClick}
      className={cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {checked && (
        <div
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current transition-none"
        >
          <CheckIcon className="size-3.5" />
        </div>
      )}
    </button>
  );
}

export { Checkbox };
