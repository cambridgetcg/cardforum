"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Award, MessageSquare } from "lucide-react";
import { EXPERT_POST_CATEGORY_LABELS, TCG_LABELS } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { type ExpertPostSummary } from "@/lib/api-client";

export type { ExpertPostSummary };

const CATEGORY_COLORS: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  PRICE_ANALYSIS: "info",
  COMBO_GUIDE: "success",
  SET_REVIEW: "default",
  CONDITION_GUIDE: "warning",
  META_ANALYSIS: "info",
  FACTORY_DEFECT: "error",
  GRADING_TIPS: "warning",
  STORAGE_TIPS: "default",
  INVESTMENT_OUTLOOK: "success",
  MARKET_TRENDS: "info",
};

interface PostCardProps {
  post: ExpertPostSummary;
  onVote?: (postId: string, value: 1 | -1) => void;
}

export function PostCard({ post, onVote }: PostCardProps) {
  const hasEndorsement = post.endorsements.length > 0;
  const score = post.upvotes - post.downvotes;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300">
      <div className="flex gap-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            onClick={() => onVote?.(post.id, 1)}
            className="rounded p-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <span className={`text-sm font-semibold ${score > 0 ? "text-emerald-600" : score < 0 ? "text-red-500" : "text-gray-400"}`}>
            {score}
          </span>
          <button
            onClick={() => onVote?.(post.id, -1)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CATEGORY_COLORS[post.category] ?? "default"}>
              {EXPERT_POST_CATEGORY_LABELS[post.category as keyof typeof EXPERT_POST_CATEGORY_LABELS] ?? post.category}
            </Badge>
            {post.tcg && <Badge>{TCG_LABELS[post.tcg as keyof typeof TCG_LABELS] ?? post.tcg}</Badge>}
            {post.language && <Badge variant="default">{post.language}</Badge>}
            {hasEndorsement && (
              <Badge variant="success">
                <Award className="mr-1 h-3 w-3" />
                Endorsed
              </Badge>
            )}
          </div>

          <Link href={`/expert/${post.id}`} className="block">
            <h3 className="font-semibold text-gray-900 hover:text-indigo-600">{post.title}</h3>
          </Link>

          {post.excerpt && (
            <p className="line-clamp-2 text-sm text-gray-600">{post.excerpt}</p>
          )}

          {/* Card/Set context */}
          {(post.card || post.set) && (
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              {post.card && (
                <span>
                  {post.card.name}{post.card.number ? ` #${post.card.number}` : ""}
                </span>
              )}
              {post.set && <span>{post.set.name} ({post.set.code})</span>}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{post.author.name ?? "Anonymous"}</span>
            {post.publishedAt && <span>{formatRelativeTime(new Date(post.publishedAt))}</span>}
            {post.helpfulCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {post.helpfulCount} found helpful
              </span>
            )}
          </div>
        </div>

        {/* Card thumbnail */}
        {post.card?.imageUrl && (
          <div className="hidden flex-shrink-0 sm:block">
            <img
              src={post.card.imageUrl}
              alt={post.card.name}
              className="h-20 w-14 rounded object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}
