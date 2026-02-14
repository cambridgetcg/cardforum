import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const CARDS = [
  // ─── Pokemon ─────────────────────────────────────
  { tcg: "POKEMON" as const, name: "Charizard ex", setName: "Obsidian Flames", setCode: "OBF", number: "125", rarity: "Double Rare" },
  { tcg: "POKEMON" as const, name: "Pikachu VMAX", setName: "Vivid Voltage", setCode: "VIV", number: "044", rarity: "VMAX" },
  { tcg: "POKEMON" as const, name: "Mewtwo ex", setName: "Scarlet & Violet 151", setCode: "MEW", number: "150", rarity: "Double Rare" },
  { tcg: "POKEMON" as const, name: "Umbreon VMAX", setName: "Evolving Skies", setCode: "EVS", number: "095", rarity: "VMAX" },
  { tcg: "POKEMON" as const, name: "Lugia V", setName: "Silver Tempest", setCode: "SIT", number: "138", rarity: "Ultra Rare" },
  { tcg: "POKEMON" as const, name: "Gardevoir ex", setName: "Scarlet & Violet", setCode: "SVI", number: "086", rarity: "Double Rare" },
  { tcg: "POKEMON" as const, name: "Mew VMAX", setName: "Fusion Strike", setCode: "FST", number: "114", rarity: "VMAX" },
  { tcg: "POKEMON" as const, name: "Rayquaza VMAX", setName: "Evolving Skies", setCode: "EVS", number: "111", rarity: "VMAX" },
  { tcg: "POKEMON" as const, name: "Arceus VSTAR", setName: "Brilliant Stars", setCode: "BRS", number: "123", rarity: "VSTAR" },
  { tcg: "POKEMON" as const, name: "Giratina VSTAR", setName: "Lost Origin", setCode: "LOR", number: "131", rarity: "VSTAR" },

  // ─── One Piece ───────────────────────────────────
  { tcg: "ONEPIECE" as const, name: "Monkey D. Luffy", setName: "Romance Dawn", setCode: "OP01", number: "003", rarity: "Leader" },
  { tcg: "ONEPIECE" as const, name: "Roronoa Zoro", setName: "Romance Dawn", setCode: "OP01", number: "025", rarity: "Super Rare" },
  { tcg: "ONEPIECE" as const, name: "Portgas D. Ace", setName: "Paramount War", setCode: "OP02", number: "013", rarity: "Super Rare" },
  { tcg: "ONEPIECE" as const, name: "Nami", setName: "Romance Dawn", setCode: "OP01", number: "016", rarity: "Super Rare" },
  { tcg: "ONEPIECE" as const, name: "Trafalgar Law", setName: "Romance Dawn", setCode: "OP01", number: "048", rarity: "Super Rare" },
  { tcg: "ONEPIECE" as const, name: "Shanks", setName: "Paramount War", setCode: "OP02", number: "007", rarity: "Leader" },
  { tcg: "ONEPIECE" as const, name: "Boa Hancock", setName: "Pillars of Strength", setCode: "OP03", number: "091", rarity: "Secret Rare" },
  { tcg: "ONEPIECE" as const, name: "Kaido", setName: "Romance Dawn", setCode: "OP01", number: "094", rarity: "Super Rare" },
  { tcg: "ONEPIECE" as const, name: "Yamato", setName: "Pillars of Strength", setCode: "OP03", number: "090", rarity: "Super Rare" },
  { tcg: "ONEPIECE" as const, name: "Sanji", setName: "Romance Dawn", setCode: "OP01", number: "013", rarity: "Rare" },

  // ─── Yu-Gi-Oh! ──────────────────────────────────
  { tcg: "YUGIOH" as const, name: "Blue-Eyes White Dragon", setName: "Legend of Blue Eyes", setCode: "LOB", number: "001", rarity: "Ultra Rare" },
  { tcg: "YUGIOH" as const, name: "Dark Magician", setName: "Legend of Blue Eyes", setCode: "LOB", number: "005", rarity: "Ultra Rare" },
  { tcg: "YUGIOH" as const, name: "Ash Blossom & Joyous Spring", setName: "Maximum Crisis", setCode: "MACR", number: "036", rarity: "Secret Rare" },
  { tcg: "YUGIOH" as const, name: "Nibiru, the Primal Being", setName: "Gold Sarcophagus Tin", setCode: "TN19", number: "013", rarity: "Prismatic Secret Rare" },
  { tcg: "YUGIOH" as const, name: "Effect Veiler", setName: "Duelist Revolution", setCode: "DREV", number: "024", rarity: "Ultra Rare" },
  { tcg: "YUGIOH" as const, name: "Accesscode Talker", setName: "Eternity Code", setCode: "ETCO", number: "046", rarity: "Ultra Rare" },
  { tcg: "YUGIOH" as const, name: "Called by the Grave", setName: "Flames of Destruction", setCode: "FLOD", number: "065", rarity: "Common" },
  { tcg: "YUGIOH" as const, name: "Infinite Impermanence", setName: "Flames of Destruction", setCode: "FLOD", number: "077", rarity: "Secret Rare" },
  { tcg: "YUGIOH" as const, name: "Ghost Ogre & Snow Rabbit", setName: "Crossed Souls", setCode: "CROS", number: "033", rarity: "Ultra Rare" },
  { tcg: "YUGIOH" as const, name: "Pot of Prosperity", setName: "Blazing Vortex", setCode: "BLVO", number: "075", rarity: "Secret Rare" },

  // ─── Magic: The Gathering ───────────────────────
  { tcg: "MTG" as const, name: "Black Lotus", setName: "Alpha", setCode: "LEA", number: "232", rarity: "Rare" },
  { tcg: "MTG" as const, name: "Lightning Bolt", setName: "Alpha", setCode: "LEA", number: "161", rarity: "Common" },
  { tcg: "MTG" as const, name: "Force of Will", setName: "Alliances", setCode: "ALL", number: "028", rarity: "Uncommon" },
  { tcg: "MTG" as const, name: "Ragavan, Nimble Pilferer", setName: "Modern Horizons 2", setCode: "MH2", number: "138", rarity: "Mythic Rare" },
  { tcg: "MTG" as const, name: "The One Ring", setName: "Lord of the Rings", setCode: "LTR", number: "246", rarity: "Mythic Rare" },
  { tcg: "MTG" as const, name: "Sheoldred, the Apocalypse", setName: "Dominaria United", setCode: "DMU", number: "107", rarity: "Mythic Rare" },
  { tcg: "MTG" as const, name: "Atraxa, Grand Unifier", setName: "Phyrexia: All Will Be One", setCode: "ONE", number: "196", rarity: "Mythic Rare" },
  { tcg: "MTG" as const, name: "Wrenn and Six", setName: "Modern Horizons", setCode: "MH1", number: "217", rarity: "Mythic Rare" },
  { tcg: "MTG" as const, name: "Solitude", setName: "Modern Horizons 2", setCode: "MH2", number: "032", rarity: "Mythic Rare" },
  { tcg: "MTG" as const, name: "Fable of the Mirror-Breaker", setName: "Kamigawa: Neon Dynasty", setCode: "NEO", number: "141", rarity: "Rare" },
];

async function main() {
  console.log("Seeding card catalog...");

  for (const card of CARDS) {
    await db.card.upsert({
      where: {
        tcg_setName_number: {
          tcg: card.tcg,
          setName: card.setName,
          number: card.number,
        },
      },
      update: {},
      create: card,
    });
  }

  console.log(`Seeded ${CARDS.length} cards across 4 TCGs.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
