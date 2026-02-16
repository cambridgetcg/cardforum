"use client";

import { useEffect, useState } from "react";
import { Select } from "./select";

interface Region {
  id: string;
  name: string;
  country: string;
}

// Country display names for grouping
const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japan",
  US: "United States",
  DE: "Germany",
  GB: "United Kingdom",
  FR: "France",
  AU: "Australia",
  CA: "Canada",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  KR: "South Korea",
  BR: "Brazil",
  MX: "Mexico",
  SG: "Singapore",
  TW: "Taiwan",
  TH: "Thailand",
  PH: "Philippines",
  ID: "Indonesia",
  NZ: "New Zealand",
  SE: "Sweden",
  PL: "Poland",
  AT: "Austria",
  BE: "Belgium",
  CH: "Switzerland",
  PT: "Portugal",
};

interface RegionSelectProps {
  value?: string;
  onChange: (regionId: string, displayName: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}

export function RegionSelect({
  value,
  onChange,
  error,
  placeholder = "Select a region...",
  className,
}: RegionSelectProps) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/regions")
      .then((res) => res.json())
      .then((data) => setRegions(data.regions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group regions by country
  const grouped: Record<string, Region[]> = {};
  for (const r of regions) {
    if (!grouped[r.country]) grouped[r.country] = [];
    grouped[r.country].push(r);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionId = e.target.value;
    const region = regions.find((r) => r.id === regionId);
    if (region) {
      onChange(regionId, `${region.name}, ${region.country}`);
    } else {
      onChange("", "");
    }
  };

  return (
    <Select
      value={value ?? ""}
      onChange={handleChange}
      error={error}
      className={className}
      disabled={loading}
    >
      <option value="">{loading ? "Loading regions..." : placeholder}</option>
      {Object.entries(grouped)
        .sort(([a], [b]) => (COUNTRY_NAMES[a] ?? a).localeCompare(COUNTRY_NAMES[b] ?? b))
        .map(([country, countryRegions]) => (
          <optgroup key={country} label={COUNTRY_NAMES[country] ?? country}>
            {countryRegions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </optgroup>
        ))}
    </Select>
  );
}
