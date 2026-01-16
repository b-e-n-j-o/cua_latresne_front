import * as React from "react";

import { cn } from "../../lib/utils";

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
}

function Slider({
  className,
  defaultValue = [0],
  value: controlledValue,
  min = 0,
  max = 100,
  step = 1,
  orientation = "horizontal",
  disabled = false,
  onValueChange,
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const values = isControlled ? controlledValue : internalValue;
  const sliderRef = React.useRef<HTMLDivElement>(null);

  const updateValue = React.useCallback((newValue: number[]) => {
    if (isControlled) {
      onValueChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }
  }, [isControlled, onValueChange]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent, index: number) => {
    if (disabled) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startValue = values[index] || min;
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = orientation === "horizontal"
        ? moveEvent.clientX - startX
        : startY - moveEvent.clientY;
      const range = orientation === "horizontal" ? rect.width : rect.height;
      const percentage = Math.max(0, Math.min(1, delta / range));
      const newValue = Math.round((min + percentage * (max - min)) / step) * step;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      
      const newValues = [...values];
      newValues[index] = clampedValue;
      updateValue(newValues);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [values, min, max, step, orientation, disabled, updateValue]);

  return (
    <div
      ref={sliderRef}
      data-slot="slider"
      data-orientation={orientation}
      data-disabled={disabled}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        orientation === "vertical" && "h-full min-h-44 w-auto flex-col",
        className
      )}
      {...props}
    >
      <div
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full",
          orientation === "horizontal" ? "h-1.5 w-full" : "h-full w-1.5"
        )}
      >
        <div
          data-slot="slider-range"
          className={cn(
            "bg-primary absolute",
            orientation === "horizontal" ? "h-full" : "w-full"
          )}
          style={
            orientation === "horizontal"
              ? {
                  left: `${((values[0] || min) - min) / (max - min) * 100}%`,
                  width: values.length > 1
                    ? `${((values[1] || max) - (values[0] || min)) / (max - min) * 100}%`
                    : `${((values[0] || min) - min) / (max - min) * 100}%`,
                }
              : {
                  bottom: `${((values[0] || min) - min) / (max - min) * 100}%`,
                  height: values.length > 1
                    ? `${((values[1] || max) - (values[0] || min)) / (max - min) * 100}%`
                    : `${((values[0] || min) - min) / (max - min) * 100}%`,
                }
          }
        />
      </div>
      {values.map((_, index) => (
        <button
          key={index}
          data-slot="slider-thumb"
          type="button"
          disabled={disabled}
          onMouseDown={(e) => handleMouseDown(e, index)}
          className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 absolute"
          style={
            orientation === "horizontal"
              ? { left: `${((values[index] || min) - min) / (max - min) * 100}%`, transform: "translateX(-50%)" }
              : { bottom: `${((values[index] || min) - min) / (max - min) * 100}%`, transform: "translateY(50%)" }
          }
        />
      ))}
    </div>
  );
}

export { Slider };
