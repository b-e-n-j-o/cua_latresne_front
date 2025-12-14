import ArticleCard from "./ArticleCard";
import type { RAGArticleSource } from "./types";


export default function ArticleCards({ sources }: { sources: RAGArticleSource[] }) {
  if (!sources?.length) return null;

  return (
    <div className="space-y-3">
      {sources.map((article, idx) => (
        <ArticleCard key={article.article_id || idx} article={article} />
      ))}
    </div>
  );
}

