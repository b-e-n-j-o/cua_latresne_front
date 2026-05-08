export type RAGArticleSource = {
  code: "urbanisme" | "construction" | "environnement";
  article_id: string;
  title: string;
  path_title?: string;
  resume?: string;
  text_clean: string;
};

