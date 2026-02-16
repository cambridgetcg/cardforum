import Link from "next/link";

/**
 * Global 404 page — shown when a route doesn't exist.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">Page not found</h2>
        <p className="mt-2 text-gray-600">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
