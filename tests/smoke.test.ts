import { describe, it, expect, afterAll } from "vitest";
import { getTestDb, disconnectDb } from "./helpers";

describe("smoke test", () => {
  afterAll(async () => {
    await disconnectDb();
  });

  it("connects to the database", async () => {
    const db = getTestDb();
    const result = await db.$queryRawUnsafe("SELECT 1 as ok");
    expect(result).toBeTruthy();
  });
});
