import { db } from "@/lib/db";
import { eventBus } from "@/server/events/event-bus";
import type {
  CreateExpertPostInput,
  UpdateExpertPostInput,
  VoteExpertPostInput,
  EndorseExpertPostInput,
  ModerateExpertPostInput,
} from "@/lib/validators";

// ─── Create ──────────────────────────────────────────

export async function createExpertPost(authorId: string, input: CreateExpertPostInput) {
  // At least one catalog anchor required
  if (!input.tcg && !input.setId && !input.cardId) {
    throw new Error("At least one of tcg, setId, or cardId is required");
  }

  const excerpt = input.excerpt ?? input.content.slice(0, 200).replace(/\n/g, " ");

  const post = await db.expertPost.create({
    data: {
      authorId,
      category: input.category,
      title: input.title,
      content: input.content,
      excerpt,
      cardId: input.cardId ?? null,
      setId: input.setId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tcg: (input.tcg as any) ?? null,
      language: input.language ?? null,
      tags: input.tags ?? [],
      mediaUrls: input.mediaUrls ?? [],
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    include: { author: { select: { id: true, name: true, image: true } }, card: true, set: true },
  });

  eventBus.emitAsync("expert_post.created", {
    postId: post.id,
    authorId,
    category: input.category,
    tcg: input.tcg,
    cardId: input.cardId,
    setId: input.setId,
  });

  return post;
}

// ─── Read ────────────────────────────────────────────

export interface ListExpertPostsParams {
  tcg?: string;
  setId?: string;
  cardId?: string;
  category?: string;
  language?: string;
  authorId?: string;
  status?: string;
  sort?: "recent" | "popular" | "helpful";
  page?: number;
  limit?: number;
}

export async function listExpertPosts(params: ListExpertPostsParams) {
  const {
    tcg,
    setId,
    cardId,
    category,
    language,
    authorId,
    status = "PUBLISHED",
    sort = "recent",
    page = 1,
    limit = 20,
  } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, unknown> = { status: status as any };
  if (tcg) where.tcg = tcg;
  if (setId) where.setId = setId;
  if (cardId) where.cardId = cardId;
  if (category) where.category = category;
  if (language) where.language = language;
  if (authorId) where.authorId = authorId;

  const orderBy =
    sort === "popular"
      ? { upvotes: "desc" as const }
      : sort === "helpful"
        ? { helpfulCount: "desc" as const }
        : { publishedAt: "desc" as const };

  const [posts, total] = await Promise.all([
    db.expertPost.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: { select: { id: true, name: true, image: true } },
        card: { select: { id: true, name: true, imageUrl: true, number: true } },
        set: { select: { id: true, name: true, code: true } },
        endorsements: { select: { id: true, endorserType: true, endorserId: true } },
        _count: { select: { votes: true, endorsements: true } },
      },
    }),
    db.expertPost.count({ where }),
  ]);

  return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getExpertPost(postId: string) {
  const post = await db.expertPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, image: true } },
      card: { select: { id: true, name: true, imageUrl: true, number: true, tcg: true } },
      set: { select: { id: true, name: true, code: true, tcg: true } },
      endorsements: true,
      _count: { select: { votes: true, endorsements: true } },
    },
  });
  if (!post) throw new Error("Expert post not found");
  return post;
}

// ─── Update ──────────────────────────────────────────

export async function updateExpertPost(
  postId: string,
  userId: string,
  input: UpdateExpertPostInput,
) {
  const existing = await db.expertPost.findUnique({ where: { id: postId } });
  if (!existing) throw new Error("Expert post not found");
  if (existing.authorId !== userId) throw new Error("Not authorized to edit this post");
  if (existing.status === "REMOVED") throw new Error("Cannot edit a removed post");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) {
    data.content = input.content;
    data.excerpt = input.excerpt ?? input.content.slice(0, 200).replace(/\n/g, " ");
  }
  if (input.category !== undefined) data.category = input.category;
  if (input.cardId !== undefined) data.cardId = input.cardId;
  if (input.setId !== undefined) data.setId = input.setId;
  if (input.tcg !== undefined) data.tcg = input.tcg;
  if (input.language !== undefined) data.language = input.language;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.mediaUrls !== undefined) data.mediaUrls = input.mediaUrls;

  return db.expertPost.update({
    where: { id: postId },
    data,
    include: { author: { select: { id: true, name: true, image: true } }, card: true, set: true },
  });
}

export async function deleteExpertPost(postId: string, userId: string) {
  const existing = await db.expertPost.findUnique({ where: { id: postId } });
  if (!existing) throw new Error("Expert post not found");
  if (existing.authorId !== userId) throw new Error("Not authorized to delete this post");

  await db.expertPost.delete({ where: { id: postId } });
}

// ─── Voting ──────────────────────────────────────────

export async function voteOnPost(postId: string, userId: string, input: VoteExpertPostInput) {
  const post = await db.expertPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Expert post not found");
  if (post.authorId === userId) throw new Error("Cannot vote on your own post");

  const existing = await db.expertVote.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    // Update existing vote
    const oldValue = existing.value;
    const oldHelpful = existing.helpful;

    await db.$transaction([
      db.expertVote.update({
        where: { id: existing.id },
        data: { value: input.value, helpful: input.helpful },
      }),
      db.expertPost.update({
        where: { id: postId },
        data: {
          upvotes: { increment: (input.value === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0) },
          downvotes: { increment: (input.value === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0) },
          helpfulCount: { increment: (input.helpful ? 1 : 0) - (oldHelpful ? 1 : 0) },
        },
      }),
    ]);
  } else {
    // Create new vote
    await db.$transaction([
      db.expertVote.create({
        data: { postId, userId, value: input.value, helpful: input.helpful },
      }),
      db.expertPost.update({
        where: { id: postId },
        data: {
          upvotes: { increment: input.value === 1 ? 1 : 0 },
          downvotes: { increment: input.value === -1 ? 1 : 0 },
          helpfulCount: { increment: input.helpful ? 1 : 0 },
        },
      }),
    ]);
  }

  return db.expertPost.findUnique({
    where: { id: postId },
    select: { upvotes: true, downvotes: true, helpfulCount: true },
  });
}

// ─── Endorsement ─────────────────────────────────────

export async function endorsePost(
  postId: string,
  endorserId: string,
  endorserType: "authenticator" | "admin",
  input: EndorseExpertPostInput,
) {
  const post = await db.expertPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Expert post not found");

  const endorsement = await db.expertEndorsement.upsert({
    where: { postId_endorserId: { postId, endorserId } },
    create: { postId, endorserId, endorserType, note: input.note },
    update: { note: input.note },
  });

  eventBus.emitAsync("expert_post.endorsed", { postId, endorserId, endorserType });

  return endorsement;
}

// ─── Moderation ──────────────────────────────────────

export async function moderatePost(
  postId: string,
  moderatorId: string,
  input: ModerateExpertPostInput,
) {
  const statusMap = { approve: "PUBLISHED", flag: "FLAGGED", remove: "REMOVED" } as const;

  const post = await db.expertPost.update({
    where: { id: postId },
    data: {
      status: statusMap[input.action],
      moderatedBy: moderatorId,
      moderatedAt: new Date(),
      moderationNote: input.note ?? null,
      publishedAt: input.action === "approve" ? new Date() : undefined,
    },
  });

  eventBus.emitAsync("expert_post.moderated", { postId, moderatorId, action: input.action });

  return post;
}

// ─── Card Insights (for card detail page) ─────────────

export async function getCardInsights(cardId: string, limit = 5) {
  return db.expertPost.findMany({
    where: { cardId, status: "PUBLISHED" },
    orderBy: [{ helpfulCount: "desc" }, { upvotes: "desc" }],
    take: limit,
    include: {
      author: { select: { id: true, name: true, image: true } },
      endorsements: { select: { id: true, endorserType: true } },
    },
  });
}

// ─── Event Handlers ─────────────────────────────────

export async function onExpertPostEndorsed(payload: {
  postId: string;
  endorserId: string;
  endorserType: "authenticator" | "admin";
}) {
  const post = await db.expertPost.findUnique({
    where: { id: payload.postId },
    select: { authorId: true, title: true },
  });
  if (!post) return;

  await db.notification.create({
    data: {
      userId: post.authorId,
      type: "EXPERT_POST_ENDORSED",
      title: "Your post was endorsed",
      message: `Your post "${post.title}" received an endorsement from ${payload.endorserType === "authenticator" ? "an authenticator" : "an admin"}.`,
      link: `/expert/${payload.postId}`,
    },
  });
}

export async function onExpertPostModerated(payload: {
  postId: string;
  moderatorId: string;
  action: "approve" | "flag" | "remove";
}) {
  if (payload.action === "approve") return;

  const post = await db.expertPost.findUnique({
    where: { id: payload.postId },
    select: { authorId: true, title: true },
  });
  if (!post) return;

  const actionLabel = payload.action === "flag" ? "flagged for review" : "removed";
  await db.notification.create({
    data: {
      userId: post.authorId,
      type: "EXPERT_POST_FLAGGED",
      title: `Your post was ${actionLabel}`,
      message: `Your post "${post.title}" has been ${actionLabel} by a moderator.`,
      link: `/expert/${payload.postId}`,
    },
  });
}

export async function getSetInsights(setId: string, limit = 5) {
  return db.expertPost.findMany({
    where: { setId, status: "PUBLISHED" },
    orderBy: [{ helpfulCount: "desc" }, { upvotes: "desc" }],
    take: limit,
    include: {
      author: { select: { id: true, name: true, image: true } },
      endorsements: { select: { id: true, endorserType: true } },
    },
  });
}
