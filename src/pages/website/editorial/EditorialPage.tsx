import "../landingpage/kereliaLandingPage.css";
import "./editorial.css";
import { KereliaSiteHeader } from "../landingpage/components/KereliaSiteHeader";
import { SiteFooterSection } from "../landingpage/landingPageSections";
import { ColumnsBlockView } from "./components/ColumnsBlock";
import { CtaBlockView } from "./components/CtaBlock";
import { FaqBlockView } from "./components/FaqBlock";
import { HeroBlockView } from "./components/HeroBlock";
import { ImageBlockView } from "./components/ImageBlock";
import { ListBlockView } from "./components/ListBlock";
import { SectionBlockView } from "./components/SectionBlock";
import { StatsBlockView } from "./components/StatsBlock";
import type { EditorialBlock, EditorialPageContent } from "./types";

function BlockView({ block }: { block: EditorialBlock }) {
  switch (block.type) {
    case "hero":
      return <HeroBlockView block={block} />;
    case "section":
      return <SectionBlockView block={block} />;
    case "list":
      return <ListBlockView block={block} />;
    case "image":
      return <ImageBlockView block={block} />;
    case "columns":
      return <ColumnsBlockView block={block} />;
    case "stats":
      return <StatsBlockView block={block} />;
    case "faq":
      return <FaqBlockView block={block} />;
    case "cta":
      return <CtaBlockView block={block} />;
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

export function EditorialPage({ page }: { page: EditorialPageContent }) {
  return (
    <div className="kerelia-landing kerelia-editorial-page">
      <KereliaSiteHeader headerClassName="kh is-scrolled" />
      <main className="kerelia-editorial">
        <p className="kerelia-editorial__section-label">{page.sectionLabel}</p>
        {page.blocks.map((block, index) => (
          <BlockView key={`${block.type}-${index}`} block={block} />
        ))}
      </main>
      <SiteFooterSection />
    </div>
  );
}
