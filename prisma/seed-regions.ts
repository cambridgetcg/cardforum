/**
 * Region seed data — Major TCG markets and metro areas.
 *
 * Run: npx tsx prisma/seed-regions.ts
 */

import { db } from "../src/lib/db";

// Maps country codes to customs zones (mirrors CUSTOMS_ZONES in constants.ts)
const COUNTRY_TO_ZONE: Record<string, string> = {
  AT: "EU",
  BE: "EU",
  BG: "EU",
  HR: "EU",
  CY: "EU",
  CZ: "EU",
  DK: "EU",
  EE: "EU",
  FI: "EU",
  FR: "EU",
  DE: "EU",
  GR: "EU",
  HU: "EU",
  IE: "EU",
  IT: "EU",
  LV: "EU",
  LT: "EU",
  LU: "EU",
  MT: "EU",
  NL: "EU",
  PL: "EU",
  PT: "EU",
  RO: "EU",
  SK: "EU",
  SI: "EU",
  ES: "EU",
  SE: "EU",
  US: "US",
  JP: "JP",
  GB: "UK",
  AU: "AU",
  NZ: "AU",
  CA: "CA",
};

function getZone(country: string): string {
  return COUNTRY_TO_ZONE[country] ?? country;
}

const REGIONS: Array<{ country: string; name: string; customsZone: string }> = [
  // Japan
  { country: "JP", name: "Tokyo", customsZone: getZone("JP") },
  { country: "JP", name: "Osaka", customsZone: getZone("JP") },
  { country: "JP", name: "Nagoya", customsZone: getZone("JP") },
  { country: "JP", name: "Fukuoka", customsZone: getZone("JP") },
  { country: "JP", name: "Sapporo", customsZone: getZone("JP") },
  { country: "JP", name: "Yokohama", customsZone: getZone("JP") },
  { country: "JP", name: "Kobe", customsZone: getZone("JP") },
  { country: "JP", name: "Kyoto", customsZone: getZone("JP") },

  // United States
  { country: "US", name: "New York", customsZone: getZone("US") },
  { country: "US", name: "Los Angeles", customsZone: getZone("US") },
  { country: "US", name: "San Francisco Bay Area", customsZone: getZone("US") },
  { country: "US", name: "Chicago", customsZone: getZone("US") },
  { country: "US", name: "Houston", customsZone: getZone("US") },
  { country: "US", name: "Miami", customsZone: getZone("US") },
  { country: "US", name: "Seattle", customsZone: getZone("US") },
  { country: "US", name: "Dallas", customsZone: getZone("US") },
  { country: "US", name: "Atlanta", customsZone: getZone("US") },
  { country: "US", name: "Boston", customsZone: getZone("US") },
  { country: "US", name: "Philadelphia", customsZone: getZone("US") },
  { country: "US", name: "Phoenix", customsZone: getZone("US") },
  { country: "US", name: "Denver", customsZone: getZone("US") },
  { country: "US", name: "Minneapolis", customsZone: getZone("US") },

  // Germany
  { country: "DE", name: "Berlin", customsZone: getZone("DE") },
  { country: "DE", name: "Munich", customsZone: getZone("DE") },
  { country: "DE", name: "Hamburg", customsZone: getZone("DE") },
  { country: "DE", name: "Frankfurt", customsZone: getZone("DE") },
  { country: "DE", name: "Cologne", customsZone: getZone("DE") },

  // United Kingdom
  { country: "GB", name: "London", customsZone: getZone("GB") },
  { country: "GB", name: "Manchester", customsZone: getZone("GB") },
  { country: "GB", name: "Birmingham", customsZone: getZone("GB") },
  { country: "GB", name: "Edinburgh", customsZone: getZone("GB") },

  // France
  { country: "FR", name: "Paris", customsZone: getZone("FR") },
  { country: "FR", name: "Lyon", customsZone: getZone("FR") },
  { country: "FR", name: "Marseille", customsZone: getZone("FR") },

  // Australia
  { country: "AU", name: "Sydney", customsZone: getZone("AU") },
  { country: "AU", name: "Melbourne", customsZone: getZone("AU") },
  { country: "AU", name: "Brisbane", customsZone: getZone("AU") },
  { country: "AU", name: "Perth", customsZone: getZone("AU") },

  // Canada
  { country: "CA", name: "Toronto", customsZone: getZone("CA") },
  { country: "CA", name: "Vancouver", customsZone: getZone("CA") },
  { country: "CA", name: "Montreal", customsZone: getZone("CA") },
  { country: "CA", name: "Calgary", customsZone: getZone("CA") },

  // Netherlands
  { country: "NL", name: "Amsterdam", customsZone: getZone("NL") },
  { country: "NL", name: "Rotterdam", customsZone: getZone("NL") },

  // Italy
  { country: "IT", name: "Milan", customsZone: getZone("IT") },
  { country: "IT", name: "Rome", customsZone: getZone("IT") },

  // Spain
  { country: "ES", name: "Madrid", customsZone: getZone("ES") },
  { country: "ES", name: "Barcelona", customsZone: getZone("ES") },

  // South Korea
  { country: "KR", name: "Seoul", customsZone: getZone("KR") },
  { country: "KR", name: "Busan", customsZone: getZone("KR") },

  // Brazil
  { country: "BR", name: "São Paulo", customsZone: getZone("BR") },
  { country: "BR", name: "Rio de Janeiro", customsZone: getZone("BR") },

  // Mexico
  { country: "MX", name: "Mexico City", customsZone: getZone("MX") },
  { country: "MX", name: "Guadalajara", customsZone: getZone("MX") },

  // Singapore
  { country: "SG", name: "Singapore", customsZone: getZone("SG") },

  // Taiwan
  { country: "TW", name: "Taipei", customsZone: getZone("TW") },

  // Thailand
  { country: "TH", name: "Bangkok", customsZone: getZone("TH") },

  // Philippines
  { country: "PH", name: "Manila", customsZone: getZone("PH") },

  // Indonesia
  { country: "ID", name: "Jakarta", customsZone: getZone("ID") },

  // New Zealand
  { country: "NZ", name: "Auckland", customsZone: getZone("NZ") },

  // Sweden
  { country: "SE", name: "Stockholm", customsZone: getZone("SE") },

  // Poland
  { country: "PL", name: "Warsaw", customsZone: getZone("PL") },

  // Austria
  { country: "AT", name: "Vienna", customsZone: getZone("AT") },

  // Belgium
  { country: "BE", name: "Brussels", customsZone: getZone("BE") },

  // Switzerland
  { country: "CH", name: "Zurich", customsZone: getZone("CH") },

  // Portugal
  { country: "PT", name: "Lisbon", customsZone: getZone("PT") },
];

async function seed() {
  console.log(`Seeding ${REGIONS.length} regions...`);

  let created = 0;
  let skipped = 0;

  for (const region of REGIONS) {
    try {
      await db.region.upsert({
        where: { country_name: { country: region.country, name: region.name } },
        update: { customsZone: region.customsZone },
        create: region,
      });
      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`Done: ${created} upserted, ${skipped} skipped`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
