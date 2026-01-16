import * as React from "react";

interface ToasterProps {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  theme?: "light" | "dark" | "system";
  richColors?: boolean;
  expand?: boolean;
  duration?: number;
  visibleToasts?: number;
  closeButton?: boolean;
  toastOptions?: any;
  className?: string;
  style?: React.CSSProperties;
}

const Toaster = ({ 
  position = "bottom-right",
  theme = "system",
  className = "toaster group",
  style,
  ...props 
}: ToasterProps) => {
  // Version simplifiée sans dépendance sonner
  // Pour une implémentation complète, il faudrait installer le package sonner
  return (
    <div
      className={className}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        ...style,
      } as React.CSSProperties}
      data-position={position}
      data-theme={theme}
      {...props}
    />
  );
};

export { Toaster };
