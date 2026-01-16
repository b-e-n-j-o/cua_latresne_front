import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "../../lib/utils";

interface AccordionContextValue {
  value: string | string[] | undefined;
  onValueChange: (value: string | string[]) => void;
  type: "single" | "multiple";
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordionItem(value: string) {
  const context = React.useContext(AccordionContext);
  if (!context) return { open: false, onToggle: () => {} };

  const isOpen = context.type === "single"
    ? context.value === value
    : Array.isArray(context.value) && context.value.includes(value);

  const onToggle = () => {
    if (context.type === "single") {
      context.onValueChange(isOpen ? "" : value);
    } else {
      const current = Array.isArray(context.value) ? context.value : [];
      context.onValueChange(
        isOpen
          ? current.filter((v) => v !== value)
          : [...current, value]
      );
    }
  };

  return { open: isOpen, onToggle };
}

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  defaultValue?: string | string[];
}

function Accordion({
  type = "single",
  value: controlledValue,
  onValueChange,
  defaultValue,
  children,
  ...props
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<string | string[]>(
    defaultValue || (type === "single" ? "" : [])
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const setValue = isControlled ? onValueChange || (() => {}) : setInternalValue;

  return (
    <AccordionContext.Provider value={{ value, onValueChange: setValue, type }}>
      <div data-slot="accordion" {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function AccordionItem({
  className,
  value,
  ...props
}: AccordionItemProps) {
  return (
    <div
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  );
}

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function AccordionTrigger({
  className,
  children,
  value,
  ...props
}: AccordionTriggerProps) {
  const { open, onToggle } = useAccordionItem(value);

  return (
    <div className="flex">
      <button
        data-slot="accordion-trigger"
        data-state={open ? "open" : "closed"}
        onClick={onToggle}
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </button>
    </div>
  );
}

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function AccordionContent({
  className,
  children,
  value,
  ...props
}: AccordionContentProps) {
  const { open } = useAccordionItem(value);

  if (!open) return null;

  return (
    <div
      data-slot="accordion-content"
      className={cn("overflow-hidden text-sm", className)}
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
