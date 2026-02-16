"use client";

import { Badge } from "@/components/ui/badge";
import {
  TCG_FILTERS,
  TCG_BADGE_COLORS,
  EXPERT_POST_CATEGORY_LABELS,
  EXPERT_POST_CATEGORY_VALUES,
  type TCG,
  type ExpertPostCategory,
} from "@/types/domain";

interface PostFiltersProps {
  tcg: string | null;
  category: string | null;
  sort: "recent" | "popular" | "helpful";
  language: string | null;
  onTcgChange: (tcg: string | null) => void;
  onCategoryChange: (category: string | null) => void;
  onSortChange: (sort: "recent" | "popular" | "helpful") => void;
  onLanguageChange: (lang: string | null) => void;
}

const LANGUAGE_OPTIONS = [
  { code: "EN", label: "English" },
  { code: "JP", label: "Japanese" },
  { code: "DE", label: "German" },
  { code: "FR", label: "French" },
  { code: "ES", label: "Spanish" },
  { code: "IT", label: "Italian" },
  { code: "PT", label: "Portuguese" },
  { code: "KR", label: "Korean" },
  { code: "ZH", label: "Chinese" },
];

export function PostFilters({
  tcg,
  category,
  sort,
  language,
  onTcgChange,
  onCategoryChange,
  onSortChange,
  onLanguageChange,
}: PostFiltersProps) {
  return (
    <div className="space-y-4">
      {/* TCG filter */}
      <div>
        <h4 className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">Game</h4>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onTcgChange(null)}>
            <Badge variant={!tcg ? "info" : "default"}>All</Badge>
          </button>
          {TCG_FILTERS.map((t) => (
            <button key={t.value} onClick={() => onTcgChange(t.value)}>
              <Badge
                variant={tcg === t.value ? "info" : "default"}
                className={tcg === t.value ? TCG_BADGE_COLORS[t.value as TCG] : ""}
              >
                {t.label}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <h4 className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
          Category
        </h4>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onCategoryChange(null)}>
            <Badge variant={!category ? "info" : "default"}>All</Badge>
          </button>
          {EXPERT_POST_CATEGORY_VALUES.map((cat) => (
            <button key={cat} onClick={() => onCategoryChange(cat)}>
              <Badge variant={category === cat ? "info" : "default"}>
                {EXPERT_POST_CATEGORY_LABELS[cat]}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Language filter */}
      <div>
        <h4 className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
          Language
        </h4>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onLanguageChange(null)}>
            <Badge variant={!language ? "info" : "default"}>All</Badge>
          </button>
          {LANGUAGE_OPTIONS.map((lang) => (
            <button key={lang.code} onClick={() => onLanguageChange(lang.code)}>
              <Badge variant={language === lang.code ? "info" : "default"}>{lang.label}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <h4 className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">Sort</h4>
        <div className="flex gap-2">
          {(["recent", "popular", "helpful"] as const).map((s) => (
            <button key={s} onClick={() => onSortChange(s)}>
              <Badge variant={sort === s ? "info" : "default"}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
