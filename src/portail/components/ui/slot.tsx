import * as React from "react";

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactElement;
}

function Slot({ children, ...props }: SlotProps) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ...children.props,
      className: `${props.className || ""} ${children.props.className || ""}`.trim(),
    } as any);
  }
  return children;
}

export { Slot };
