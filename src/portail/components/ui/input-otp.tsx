import * as React from "react";
import { MinusIcon } from "lucide-react";

import { cn } from "../../lib/utils";

interface InputOTPContextValue {
  slots: Array<{ char?: string; hasFakeCaret?: boolean; isActive?: boolean }>;
  value: string;
  setValue: (value: string) => void;
  maxLength: number;
}

const InputOTPContext = React.createContext<InputOTPContextValue | null>(null);

interface InputOTPProps extends React.HTMLAttributes<HTMLDivElement> {
  maxLength?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
}

function InputOTP({
  className,
  containerClassName,
  maxLength = 6,
  value: controlledValue,
  onValueChange,
  children,
  ...props
}: InputOTPProps) {
  const [internalValue, setInternalValue] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (isControlled) {
      onValueChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  const slots = Array.from({ length: maxLength }, (_, index) => ({
    char: value[index],
    hasFakeCaret: index === activeIndex && value.length < maxLength,
    isActive: index === activeIndex,
  }));

  return (
    <InputOTPContext.Provider
      value={{
        slots,
        value,
        setValue: handleValueChange,
        maxLength,
      }}
    >
      <div
        data-slot="input-otp"
        className={cn(
          "flex items-center gap-2 has-disabled:opacity-50",
          containerClassName
        )}
        {...props}
      >
        <input
          type="text"
          inputMode="numeric"
          maxLength={maxLength}
          value={value}
          onChange={(e) => {
            const newValue = e.target.value.replace(/\D/g, "").slice(0, maxLength);
            handleValueChange(newValue);
            setActiveIndex(Math.min(newValue.length, maxLength - 1));
          }}
          onFocus={(e) => {
            const index = Math.min(value.length, maxLength - 1);
            setActiveIndex(index);
            e.target.setSelectionRange(index, index);
          }}
          className={cn("sr-only", className)}
        />
        {children}
      </div>
    </InputOTPContext.Provider>
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

interface InputOTPSlotProps extends React.ComponentProps<"div"> {
  index: number;
}

function InputOTPSlot({
  index,
  className,
  ...props
}: InputOTPSlotProps) {
  const context = React.useContext(InputOTPContext);
  const { char, hasFakeCaret, isActive } = context?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
