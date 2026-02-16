"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PostCard } from "@/components/expert/post-card";
import { PostFilters } from "@/components/expert/post-filters";
import { CreatePostForm, type CreatePostData } from "@/components/expert/create-post-form";
import { Button } from "@/components/ui/button";
import { PenLine } from "lucide-react";
import { useExpertPosts, useCreateExpertPost, useVoteExpertPost } from "@/hooks/use-api";

export default function ExpertHubPage() {
  const { data: session } = useSession();

  // Filters
  const [tcg, setTcg] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "popular" | "helpful">("recent");
  const [language, setLanguage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Create form
  const [showCreate, setShowCreate] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [tcg, category, sort, language]);

  const { data, isLoading } = useExpertPosts({
    tcg: tcg ?? undefined,
    category: category ?? undefined,
    sort,
    language: language ?? undefined,
    page,
  });

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const createMutation = useCreateExpertPost();
  const voteMutation = useVoteExpertPost();

  function handleVote(postId: string, value: 1 | -1) {
    if (!session) return;
    voteMutation.mutate({ postId, value, helpful: false });
  }

  async function handleCreate(data: CreatePostData) {
    await createMutation.mutateAsync(data);
    setShowCreate(false);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expert Hub</h1>
          <p className="text-sm text-gray-500">
            Knowledge from the community — price analyses, combo guides, condition tips, and more.
          </p>
        </div>
        {session && (
          <Button onClick={() => setShowCreate(!showCreate)} size="sm">
            <PenLine className="mr-1.5 h-4 w-4" />
            Write Post
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
          <h2 className="mb-4 text-lg font-semibold">New Expert Post</h2>
          <CreatePostForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            defaultTcg={tcg ?? undefined}
          />
        </div>
      )}

      <PostFilters
        tcg={tcg}
        category={category}
        sort={sort}
        language={language}
        onTcgChange={setTcg}
        onCategoryChange={setCategory}
        onSortChange={setSort}
        onLanguageChange={setLanguage}
      />

      <div className="text-sm text-gray-500">
        {total} post{total !== 1 ? "s" : ""}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          No posts yet. Be the first to share your expertise!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onVote={session ? handleVote : undefined} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
