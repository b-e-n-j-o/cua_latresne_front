import { useEffect, useRef, useState } from "react";
import { moisAnnee } from "./libelles";
import type { IsoDate } from "./types";

interface Props {
  dates: IsoDate[]; // millésimes triés croissants
  value: IsoDate;
  onChange: (d: IsoDate) => void;
}

const PAS_LECTURE_MS = 1500;

export default function TimeSlider({ dates, value, onChange }: Props) {
  const idx = Math.max(0, dates.indexOf(value));
  const [lecture, setLecture] = useState(false);
  const idxRef = useRef(idx);
  idxRef.current = idx;

  // Lecture automatique : avance d'un cran, s'arrête au dernier millésime.
  useEffect(() => {
    if (!lecture) return;
    const t = setInterval(() => {
      const next = idxRef.current + 1;
      if (next >= dates.length) {
        setLecture(false);
        return;
      }
      onChange(dates[next]);
    }, PAS_LECTURE_MS);
    return () => clearInterval(t);
  }, [lecture, dates, onChange]);

  // Clavier : ← → changent de millésime, espace lance ou arrête la lecture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft" && idxRef.current > 0) {
        e.preventDefault();
        onChange(dates[idxRef.current - 1]);
      } else if (e.key === "ArrowRight" && idxRef.current < dates.length - 1) {
        e.preventDefault();
        onChange(dates[idxRef.current + 1]);
      } else if (e.key === " ") {
        e.preventDefault();
        setLecture((l) => !l);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dates, onChange]);

  if (!dates.length) return null;

  return (
    <div className="flex h-[72px] items-center gap-3 border-t border-slate-200 bg-white px-4">
      <button
        type="button"
        onClick={() => {
          if (!lecture && idx === dates.length - 1) onChange(dates[0]);
          setLecture((l) => !l);
        }}
        className="h-8 w-8 shrink-0 rounded-full border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        aria-label={lecture ? "Arrêter la lecture" : "Lire les millésimes"}
        title="Espace"
      >
        {lecture ? "❚❚" : "▶"}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onChange(dates[Number(e.target.value)])}
          className="w-full accent-blue-600"
          aria-label="Millésime du cadastre"
          aria-valuetext={moisAnnee(value)}
        />
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>{moisAnnee(dates[0])}</span>
          <span>{moisAnnee(dates[dates.length - 1])}</span>
        </div>
      </div>

      <div className="w-28 shrink-0 text-right">
        <div className="text-sm font-semibold text-slate-900">{moisAnnee(value)}</div>
        <div className="text-[11px] text-slate-500">
          {idx + 1} / {dates.length}
        </div>
      </div>
    </div>
  );
}
