"use client";

import { use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Award, ArrowLeft, Trash2 } from "lucide-react";
import { EXPERT_POST_CATEGORY_LABELS, TCG_LABELS } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { useExpertPost, useVoteExpertPost, useDeleteExpertPost } from "@/hooks/use-api";
import Link from "next/link";

export default function ExpertPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();

  const { data, isLoading, error } = useExpertPost(postId);
  const voteMutation = useVoteExpertPost();
  const deleteMutation = useDeleteExpertPost();

  const post = data?.post ?? null;

  function handleVote(value: 1 | -1) {
    if (!session) return;
    voteMutation.mutate({ postId, value, helpful: value === 1 });
  }

  function handleDelete() {
    if (!confirm("Delete this post?")) return;
    deleteMutation.mutate(postId, {
      onSuccess: () => router.push("/expert"),
    });
  }

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading...</div>;
  if (error || !post) return <div className="py-12 text-center text-red-500">{error instanceof Error ? error.message : "Post not found"}</div>;

  const score = post.upvotes - post.downvotes;
  const isAuthor = session?.user?.id === post.authorId;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Back link */}
      <Link href="/expert" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Expert Hub
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">
            {EXPERT_POST_CATEGORY_LABELS[post.category as keyof typeof EXPERT_POST_CATEGORY_LABELS] ?? post.category}
          </Badge>
          {post.tcg && <Badge>{TCG_LABELS[post.tcg as keyof typeof TCG_LABELS] ?? post.tcg}</Badge>}
          {post.language && <Badge variant="default">{post.language}</Badge>}
          {post.endorsements.length > 0 && (
            <Badge variant="success">
              <Award className="mr-1 h-3 w-3" />
              {post.endorsements.length} Endorsement{post.endorsements.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>By {post.author.name ?? "Anonymous"}</span>
          {post.publishedAt && <span>{formatRelativeTime(new Date(post.publishedAt))}</span>}
        </div>
      </div>

      {/* Card/Set context */}
      {(post.card || post.set) && (
        <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
          {post.card?.imageUrl && (
            <img src={post.card.imageUrl} alt={post.card.name} className="h-24 w-16 rounded object-cover" />
          )}
          <div className="text-sm">
            {post.card && (
              <Link href={`/browse/cards/${post.card.id}`} className="font-medium text-indigo-600 hover:underline">
                {post.card.name}{post.card.number ? ` #${post.card.number}` : ""}
              </Link>
            )}
            {post.set && (
              <p className="text-gray-500">
                <Link href={`/browse/sets/${post.set.id}`} className="hover:underline">
                  {post.set.name} ({post.set.code})
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">
        {post.content}
      </div>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-4 border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote(1)}
            disabled={!session}
            className="rounded p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
          >
            <ThumbsUp className="h-5 w-5" />
          </button>
          <span className={`text-lg font-semibold ${score > 0 ? "text-emerald-600" : score < 0 ? "text-red-500" : "text-gray-400"}`}>
            {score}
          </span>
          <button
            onClick={() => handleVote(-1)}
            disabled={!session}
            className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <ThumbsDown className="h-5 w-5" />
          </button>
        </div>

        <span className="text-sm text-gray-400">{post.helpfulCount} found helpful</span>

        <div className="flex-1" />

        {isAuthor && (
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-600">
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        )}
      </div>

      {/* Endorsements */}
      {post.endorsements.length > 0 && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <Award className="h-4 w-4" /> Expert Endorsements
          </h3>
          {post.endorsements.map((e) => (
            <div key={e.id} className="text-sm text-emerald-700">
              <span className="font-medium">{e.endorserType === "authenticator" ? "Authenticator" : "Admin"}</span>
              {e.note && <span> — {e.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
