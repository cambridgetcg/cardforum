import { CardSearch } from "@/components/listings/card-search";

export default function BrowsePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Browse Cards</h1>
      <p className="mt-1 text-sm text-gray-600">
        Search the card catalog across all supported TCGs
      </p>

      <div className="mt-6">
        <CardSearch />
      </div>
    </div>
  );
}
