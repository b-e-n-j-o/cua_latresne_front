import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/* ======================================================
   Section (inchangée, très bonne telle quelle)
====================================================== */

type SectionProps = {
  id: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
};

function Section({
  title,
  children,
  defaultOpen = false,
  icon,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border border-gray-200 rounded-md overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-700"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span>{title}</span>
        </div>
        <span className="text-gray-400">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && <div className="p-3 bg-white">{children}</div>}
    </section>
  );
}

/* ======================================================
   Sidebar modulaire
====================================================== */

export type SideBarSection = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  fallback?: ReactNode;
};

type SideBarLeftProps = {
  sections?: SideBarSection[];
};

export function SideBarLeft({ sections = [] }: SideBarLeftProps) {
  return (
    <aside className="w-80 h-full border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {sections.length === 0 ? (
          <div className="text-xs text-gray-500 italic text-center py-6">
            Aucun outil disponible pour cette page
          </div>
        ) : (
          sections.map((section) => (
            <Section
              key={section.id}
              id={section.id}
              title={section.title}
              defaultOpen={section.defaultOpen}
              icon={section.icon}
            >
              {section.content ?? section.fallback ?? (
                <div className="text-xs text-gray-500 italic text-center py-4">
                  Contenu indisponible
                </div>
              )}
            </Section>
          ))
        )}
      </div>
    </aside>
  );
}
