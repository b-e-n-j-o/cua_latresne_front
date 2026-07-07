import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hslClassColor, hueFromWheelClick } from "../cartoClassColors";

type Props = {
  color: string;
  onChange: (color: string) => void;
};

export default function LegendClassColorPicker({ color, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openPicker = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor(rect);
    setOpen(true);
  }, []);

  const pickFromWheel = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const hue = hueFromWheelClick(event.clientX, event.clientY, rect);
      if (hue === null) {
        close();
        return;
      }
      onChange(hslClassColor(hue));
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="carto-legend-shell__swatch-trigger"
        title="Choisir une couleur"
        onClick={openPicker}
      >
        <span className="carto-legend-shell__swatch" style={{ background: color }} />
      </button>

      {open && anchor
        ? createPortal(
            <div
              ref={popoverRef}
              className="carto-legend-shell__picker-popover carto-legend-shell__picker-popover--fixed"
              style={{
                top: Math.min(anchor.bottom + 6, window.innerHeight - 140),
                left: Math.min(anchor.left, window.innerWidth - 132),
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="carto-legend-shell__picker-wheel"
                title="Cliquer pour appliquer la couleur"
                onClick={pickFromWheel}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
