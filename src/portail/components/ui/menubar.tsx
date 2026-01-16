import * as React from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { cn } from "../../lib/utils";

interface MenubarContextValue {
  openMenu: string | null;
  setOpenMenu: (menu: string | null) => void;
}

const MenubarContext = React.createContext<MenubarContextValue | null>(null);

function useMenubar() {
  const context = React.useContext(MenubarContext);
  if (!context) {
    throw new Error("Menubar components must be used within Menubar");
  }
  return context;
}

interface MenubarProps extends React.HTMLAttributes<HTMLDivElement> {}

function Menubar({
  className,
  children,
  ...props
}: MenubarProps) {
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const content = document.querySelector('[data-slot="menubar-content"]');
      if (content && !content.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  return (
    <MenubarContext.Provider value={{ openMenu, setOpenMenu }}>
      <div
        data-slot="menubar"
        className={cn(
          "bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </MenubarContext.Provider>
  );
}

function MenubarMenu({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="menubar-menu" {...props}>
      {children}
    </div>
  );
}

function MenubarGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="menubar-group" {...props}>
      {children}
    </div>
  );
}

function MenubarPortal({ children }: { children: React.ReactNode }) {
  return typeof window !== "undefined" ? createPortal(children, document.body) : null;
}

function MenubarRadioGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="menubar-radio-group" role="radiogroup" {...props}>
      {children}
    </div>
  );
}

interface MenubarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function MenubarTrigger({
  className,
  ...props
}: MenubarTriggerProps) {
  const { openMenu, setOpenMenu } = useMenubar();
  const menuId = React.useId();
  const isOpen = openMenu === menuId;

  return (
    <button
      data-slot="menubar-trigger"
      data-state={isOpen ? "open" : "closed"}
      onClick={() => setOpenMenu(isOpen ? null : menuId)}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none",
        className
      )}
      {...props}
    />
  );
}

interface MenubarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  alignOffset?: number;
  sideOffset?: number;
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  children,
  ...props
}: MenubarContentProps) {
  const { openMenu } = useMenubar();
  const menuId = React.useId();
  const isOpen = openMenu === menuId;

  if (!isOpen) return null;

  return (
    <MenubarPortal>
      <div
        data-slot="menubar-content"
        className={cn(
          "bg-popover text-popover-foreground z-50 min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md animate-in fade-in-0 zoom-in-95",
          className
        )}
        style={{
          marginTop: `${sideOffset}px`,
          marginLeft: align === "start" ? `${alignOffset}px` : undefined,
        }}
        {...props}
      >
        {children}
      </div>
    </MenubarPortal>
  );
}

interface MenubarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenubarItemProps) {
  return (
    <div
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

interface MenubarCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
}

function MenubarCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenubarCheckboxItemProps) {
  return (
    <div
      data-slot="menubar-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CheckIcon className="size-4" />}
      </span>
      {children}
    </div>
  );
}

interface MenubarRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
}

function MenubarRadioItem({
  className,
  children,
  checked,
  ...props
}: MenubarRadioItemProps) {
  return (
    <div
      data-slot="menubar-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CircleIcon className="size-2 fill-current" />}
      </span>
      {children}
    </div>
  );
}

interface MenubarLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  inset?: boolean;
}

function MenubarLabel({
  className,
  inset,
  ...props
}: MenubarLabelProps) {
  return (
    <label
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="menubar-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
}

function MenubarSub({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="menubar-sub" {...props}>
      {children}
    </div>
  );
}

interface MenubarSubTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenubarSubTriggerProps) {
  return (
    <div
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-4 w-4" />
    </div>
  );
}

function MenubarSubContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="menubar-sub-content"
      className={cn(
        "bg-popover text-popover-foreground z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
