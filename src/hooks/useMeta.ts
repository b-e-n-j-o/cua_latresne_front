import { useEffect } from "react";

type MetaOptions = {
  title?: string;
  description?: string;
};

/**
 * Hook pour mettre à jour <title> et <meta name="description">
 * depuis une page React.
 */
export function useMeta({ title, description }: MetaOptions) {
  useEffect(() => {
    // ✅ Met à jour le titre
    if (title) {
      document.title = title;
    }

    // ✅ Met à jour la meta description
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
}
