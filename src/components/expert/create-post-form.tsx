"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LinkIcon, X } from "lucide-react";
import { CardSearch } from "@/components/listings/card-search";
import {
  TCG_FILTERS,
  EXPERT_POST_CATEGORY_LABELS,
  EXPERT_POST_CATEGORY_VALUES,
  type ExpertPostCategory,
} from "@/types/domain";

interface SelectedCard {
  id: string;
  name: string;
  tcg: string;
  setName: string;
  imageUrl: string | null;
}

export interface CreatePostData {
  title: string;
  content: string;
  category: ExpertPostCategory;
  tcg?: string;
  cardId?: string;
  setId?: string;
  language?: string;
  tags: string[];
}

interface CreatePostFormProps {
  onSubmit: (data: CreatePostData) => Promise<void>;
  onCancel: () => void;
  defaultTcg?: string;
  defaultCardId?: string;
  defaultSetId?: string;
}

export function CreatePostForm({ onSubmit, onCancel, defaultTcg, defaultCardId, defaultSetId }: CreatePostFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<ExpertPostCategory>("SET_REVIEW");
  const [tcg, setTcg] = useState(defaultTcg ?? "");
  const [language, setLanguage] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Card picker
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(
    defaultCardId ? null : null
  );

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !tcg) {
      setError("Title, content, and game are required");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        category,
        tcg: tcg || undefined,
        cardId: selectedCard?.id ?? defaultCardId,
        setId: defaultSetId,
        language: language || undefined,
        tags,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. OP07 Luffy price trajectory analysis"
          maxLength={200}
        />
      </div>

      {/* Category */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
        <div className="flex flex-wrap gap-2">
          {EXPERT_POST_CATEGORY_VALUES.map((cat) => (
            <button type="button" key={cat} onClick={() => setCategory(cat)}>
              <Badge variant={category === cat ? "info" : "default"}>
                {EXPERT_POST_CATEGORY_LABELS[cat]}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* TCG */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Game</label>
        <select
          value={tcg}
          onChange={(e) => setTcg(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select game...</option>
          {TCG_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Card Picker */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Linked Card (optional)</label>
        {selectedCard ? (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            {selectedCard.imageUrl && (
              <img src={selectedCard.imageUrl} alt={selectedCard.name} className="h-12 w-8 rounded object-cover" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{selectedCard.name}</p>
              <p className="text-xs text-gray-500">{selectedCard.setName}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCard(null)}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : showCardPicker ? (
          <div className="space-y-2">
            <CardSearch
              mode="select"
              onSelect={(card) => {
                setSelectedCard({
                  id: card.id,
                  name: card.name,
                  tcg: card.tcg,
                  setName: card.setName,
                  imageUrl: card.imageUrl,
                });
                if (!tcg && card.tcg) setTcg(card.tcg);
                setShowCardPicker(false);
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCardPicker(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCardPicker(true)}>
            <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
            Link a Card
          </Button>
        )}
      </div>

      {/* Language */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Language (optional)</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Cross-language (all)</option>
          <option value="EN">English</option>
          <option value="JP">Japanese</option>
          <option value="DE">German</option>
          <option value="FR">French</option>
          <option value="ES">Spanish</option>
          <option value="IT">Italian</option>
          <option value="PT">Portuguese</option>
          <option value="KR">Korean</option>
          <option value="ZH">Chinese</option>
        </select>
      </div>

      {/* Content */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Content (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your expert knowledge..."
          rows={10}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          maxLength={50000}
        />
        <p className="mt-1 text-xs text-gray-400">{content.length}/50,000 characters</p>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Tags</label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag..."
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="default" className="cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                {tag} &times;
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Publishing..." : "Publish"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
