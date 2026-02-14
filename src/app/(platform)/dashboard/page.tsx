import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowRightLeft, ListChecks, Package } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">
        Welcome to CardForum. Here&apos;s your trading overview.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Active Listings</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">have &amp; want listings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Active Trades</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">trades in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Completed</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">successful trades</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No recent activity. Start by listing cards you want to trade!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
