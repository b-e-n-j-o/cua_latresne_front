import { demoContactCtaCopy } from "../LandingPageContent";
import { cn } from "../lib/cn";

type FloatingDemoCtaProps = {
  visible: boolean;
  overLight?: boolean;
};

export function FloatingDemoCta({ visible, overLight = false }: FloatingDemoCtaProps) {
  return (
    <a
      className={cn(
        "kerelia-floating-demo",
        visible && "is-visible",
        overLight && "kerelia-floating-demo--on-light"
      )}
      href={demoContactCtaCopy.href}
      aria-label={demoContactCtaCopy.label}
    >
      {demoContactCtaCopy.label}
    </a>
  );
}
