import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ListingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your have and want listings
          </p>
        </div>
        <Button>Add Listing</Button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Cards I Have
          </h2>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No have listings yet.</p>
              <Link href="/browse" className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-500">
                Browse the catalog to add cards
              </Link>
            </CardContent>
          </Card>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Cards I Want
          </h2>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No want listings yet.</p>
              <Link href="/browse" className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-500">
                Browse the catalog to add cards
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
