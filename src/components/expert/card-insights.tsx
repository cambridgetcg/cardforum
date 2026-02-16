"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Award, ThumbsUp } from "lucide-react";
import { EXPERT_POST_CATEGORY_LABELS } from "@/types/domain";
import { useExpertPosts } from "@/hooks/use-api";

export function CardInsights({ cardId }: { cardId: string }) {
  const { data, isLoading } = useExpertPosts({ cardId, sort: "helpful", limit: 5 });
  const posts = data?.posts ?? [];

  if (isLoading) return null;
  if (posts.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <h2 className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
        <BookOpen className="h-4 w-4 text-indigo-500" />
        Expert Insights ({posts.length})
      </h2>
      <div className="divide-y divide-gray-50">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/expert/${post.id}`}
            className="flex items-start gap-3 px-5 py-3 transition hover:bg-gray-50"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{post.title}</span>
                {post.endorsements.length > 0 && <Award className="h-3.5 w-3.5 text-emerald-500" />}
              </div>
              {post.excerpt && <p className="line-clamp-1 text-xs text-gray-500">{post.excerpt}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{post.author.name ?? "Anonymous"}</span>
                <Badge variant="default" className="text-[10px]">
                  {EXPERT_POST_CATEGORY_LABELS[
                    post.category as keyof typeof EXPERT_POST_CATEGORY_LABELS
                  ] ?? post.category}
                </Badge>
              </div>
            </div>
            {post.helpfulCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <ThumbsUp className="h-3 w-3" />
                {post.helpfulCount}
              </div>
            )}
          </Link>
        ))}
      </div>
      <Link
        href={`/expert?cardId=${cardId}`}
        className="block border-t border-gray-100 px-5 py-2.5 text-center text-xs text-indigo-600 hover:bg-indigo-50"
      >
        View all expert posts for this card
      </Link>
    </div>
  );
}
