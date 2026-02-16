import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { resolveRole, hasRole } from "@/server/middleware/rbac";

const NAV_ITEMS = [
  { href: "/admin/kyc", label: "KYC Review" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/authenticators", label: "Authenticators" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/config", label: "Config" },
  { href: "/admin/calibration", label: "CCS Calibration" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const role = await resolveRole(session.user.id);
  if (!hasRole(role, "ADMIN")) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">403 — Forbidden</h1>
        <p className="mt-2 text-gray-600">
          You do not have permission to access the admin panel.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-500"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <aside className="hidden w-48 shrink-0 md:block">
        <nav className="sticky top-24 space-y-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Admin
          </p>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
