import { Card, CardContent } from "@/components/ui/card";

export default function TradesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Trades</h1>
      <p className="mt-1 text-sm text-gray-600">
        View and manage your active trades
      </p>

      <div className="mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No active trades. When the matching engine finds a bridge for your
              listings, trade proposals will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
