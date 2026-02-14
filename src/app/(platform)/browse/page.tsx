import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function BrowsePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Browse Cards</h1>
      <p className="mt-1 text-sm text-gray-600">
        Search the card catalog across all supported TCGs
      </p>

      <div className="mt-6 max-w-lg">
        <Input placeholder="Search cards by name, set, or number..." />
      </div>

      <div className="mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              Search for a card to get started. The catalog supports Pokemon,
              Yu-Gi-Oh!, One Piece, and Magic: The Gathering.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
