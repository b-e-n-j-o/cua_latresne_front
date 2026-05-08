import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RAGArticleSource } from "./types";

export default function ArticleCard({ article }: { article: RAGArticleSource }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#D5E1E3] rounded-xl p-4 bg-white">
      <div
        className="flex justify-between items-start cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div>
          <div className="text-xs uppercase text-gray-500">
            Code de {article.code}
          </div>
          <h4 className="font-semibold text-sm">
            {article.title}
          </h4>
          {article.path_title && (
            <p className="text-xs text-gray-500 mt-1">
              {article.path_title}
            </p>
          )}
        </div>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </div>

      {open && (
        <div className="mt-4 text-sm whitespace-pre-line text-[#1A2B42]">
          {article.text_clean}
        </div>
      )}
    </div>
  );
}

