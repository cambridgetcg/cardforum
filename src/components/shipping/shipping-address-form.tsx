"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ShippingAddressFormProps {
  onSaved: () => void;
  initialData?: {
    id?: string;
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
    isDefault: boolean;
  };
}

export function ShippingAddressForm({ onSaved, initialData }: ShippingAddressFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      label: form.get("label") as string,
      line1: form.get("line1") as string,
      line2: (form.get("line2") as string) || undefined,
      city: form.get("city") as string,
      state: (form.get("state") as string) || undefined,
      postalCode: form.get("postalCode") as string,
      country: (form.get("country") as string).toUpperCase(),
      phone: (form.get("phone") as string) || undefined,
      isDefault: form.get("isDefault") === "on",
    };

    try {
      const res = await fetch("/api/users/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ? JSON.stringify(data.error) : "Failed to save address");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Label</label>
          <Input name="label" defaultValue={initialData?.label ?? "Home"} required />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Country (ISO code)</label>
          <Input
            name="country"
            defaultValue={initialData?.country ?? ""}
            placeholder="US, JP, DE, GB..."
            maxLength={2}
            required
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Address Line 1</label>
        <Input name="line1" defaultValue={initialData?.line1 ?? ""} required />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Address Line 2</label>
        <Input name="line2" defaultValue={initialData?.line2 ?? ""} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">City</label>
          <Input name="city" defaultValue={initialData?.city ?? ""} required />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">State/Province</label>
          <Input name="state" defaultValue={initialData?.state ?? ""} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Postal Code</label>
          <Input name="postalCode" defaultValue={initialData?.postalCode ?? ""} required />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Phone</label>
        <Input name="phone" defaultValue={initialData?.phone ?? ""} placeholder="+1234567890" />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isDefault"
          id="isDefault"
          defaultChecked={initialData?.isDefault ?? true}
          className="rounded"
        />
        <label htmlFor="isDefault" className="text-sm text-gray-700">
          Set as default shipping address
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Address"}
      </Button>
    </form>
  );
}
