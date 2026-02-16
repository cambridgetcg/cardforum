"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EXPERT_POST_CATEGORY_LABELS } from "@/types/domain";

interface ExpertPost {
  id: string;
  title: string;
  category: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null };
}

interface PostsResponse {
  posts: ExpertPost[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  DRAFT: "default",
  PENDING: "info",
  PUBLISHED: "success",
  FLAGGED: "warning",
  REMOVED: "error",
};

const FILTER_TABS = [
  { label: "All", value: "" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Flagged", value: "FLAGGED" },
  { label: "Removed", value: "REMOVED" },
] as const;

export default function AdminContentPage() {
  const [posts, setPosts] = useState<ExpertPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [moderating, setModerating] = useState<string | null>(null);

  const fetchPosts = async (status: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("page", String(p));
      params.set("limit", "20");
      const res = await fetch(`/api/expert/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data: PostsResponse = await res.json();
      setPosts(data.posts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchPosts(filter, 1);
  }, [filter]);

  useEffect(() => {
    if (page > 1) fetchPosts(filter, page);
  }, [page]);

  async function handleModerate(postId: string, action: "approve" | "flag" | "remove") {
    setModerating(postId);
    try {
      const res = await fetch(`/api/expert/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      fetchPosts(filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Moderation failed");
    } finally {
      setModerating(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={filter === tab.value ? "primary" : "outline"}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-gray-500">
            {total} post{total !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
          ) : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No posts</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-xs truncate">
                      <Link
                        href={`/expert/${p.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.author.name ?? "Anonymous"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="text-[10px]">
                        {EXPERT_POST_CATEGORY_LABELS[p.category as keyof typeof EXPERT_POST_CATEGORY_LABELS] ?? p.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[p.status] ?? "default"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {p.publishedAt
                        ? new Date(p.publishedAt).toLocaleDateString()
                        : new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.status !== "PUBLISHED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={moderating === p.id}
                            onClick={() => handleModerate(p.id, "approve")}
                          >
                            Approve
                          </Button>
                        )}
                        {p.status !== "FLAGGED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={moderating === p.id}
                            onClick={() => handleModerate(p.id, "flag")}
                          >
                            Flag
                          </Button>
                        )}
                        {p.status !== "REMOVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={moderating === p.id}
                            onClick={() => handleModerate(p.id, "remove")}
                            className="text-red-500 hover:text-red-600"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
