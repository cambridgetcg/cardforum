"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { TCG_LABELS, TCG_BADGE_COLORS, type TCG } from "@/types/domain";

interface CardGridItemProps {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  variantCount: number;
  owned?: boolean;
  onHave?: () => void;
  onWant?: () => void;
  onCollect?: () => void;
}

export function CardGridItem({
  id,
  tcg,
  name,
  setName,
  setCode,
  number,
  rarity,
  imageUrl,
  variantCount,
  owned,
  onHave,
  onWant,
  onCollect,
}: CardGridItemProps) {
  return (
    <Link
      href={`/browse/cards/${id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-indigo-300 hover:shadow-md"
    >
      <div className="relative aspect-[5/7] w-full bg-gray-100">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-contain" loading="lazy" />
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

        {/* Owned badge */}
        {owned && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
            <Heart className="h-3 w-3 fill-current" />
            Owned
          </span>
        )}

        {variantCount > 1 && (
          <span className="absolute right-1.5 bottom-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
            {variantCount} variants
          </span>
        )}

        {/* Hover overlay with quick actions — desktop only */}
        {(onHave || onWant || onCollect) && (
          <div className="absolute inset-0 hidden items-end justify-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
            {onCollect && !owned && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCollect();
                }}
                className="rounded-full bg-rose-500 px-3 py-1 text-xs font-medium text-white shadow-md hover:bg-rose-600"
              >
                Collect
              </button>
            )}
            {onHave && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onHave();
                }}
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-md hover:bg-emerald-700"
              >
                Sell
              </button>
            )}
            {onWant && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onWant();
                }}
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-md hover:bg-blue-700"
              >
                Buy
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-1">
          <h3 className="line-clamp-2 text-sm leading-tight font-semibold text-gray-900">{name}</h3>
          <Badge variant={TCG_BADGE_COLORS[tcg]} className="shrink-0 text-[10px]">
            {TCG_LABELS[tcg]}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          {setName}
          {setCode && ` (${setCode})`}
        </p>
        {number && <p className="text-xs text-gray-400">#{number}</p>}
        {rarity && <p className="text-xs text-gray-400">{rarity}</p>}
        {/* Mobile action buttons — visible on touch, hidden on hover-capable */}
        {(onCollect || onHave || onWant) && (
          <div className="mt-1 flex gap-1.5 md:hidden">
            {onCollect && !owned && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCollect();
                }}
                className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-medium text-white active:bg-rose-600"
              >
                Collect
              </button>
            )}
            {onHave && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onHave();
                }}
                className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-medium text-white active:bg-emerald-700"
              >
                Have
              </button>
            )}
            {onWant && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onWant();
                }}
                className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-medium text-white active:bg-blue-700"
              >
                Want
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
