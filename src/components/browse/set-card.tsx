import { Badge } from "@/components/ui/badge";
import { TCG_LABELS, TCG_BADGE_COLORS, type TCG } from "@/types/domain";

interface SetCardProps {
  code: string;
  name: string;
  tcg: TCG;
  productType: string | null;
  cardCount: number;
  coverImage: string | null;
}

export function SetCard({ code, name, tcg, productType, cardCount, coverImage }: SetCardProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-indigo-300 hover:shadow-md">
      <div className="relative aspect-[5/7] w-full bg-gray-100">
        {coverImage ? (
          <img
            src={coverImage}
            alt={name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}
        <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          {cardCount} cards
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-1">
          <h3 className="line-clamp-2 text-sm leading-tight font-semibold text-gray-900">{name}</h3>
          <Badge variant={TCG_BADGE_COLORS[tcg]} className="shrink-0 text-[10px]">
            {TCG_LABELS[tcg]}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-600">
            {code}
          </span>
          {productType && <span className="text-xs text-gray-400 capitalize">{productType}</span>}
        </div>
      </div>
    </div>
  );
}
