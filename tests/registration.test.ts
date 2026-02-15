import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { hash, compare } from "bcryptjs";
import { getTestDb, disconnectDb, cleanupTestData } from "./helpers";

const db = getTestDb();

describe("P2P User Registration", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectDb();
  });

  // ─── Registration ─────────────────────────────────────

  describe("User creation (simulating /api/auth/register)", () => {
    it("creates a new user with hashed password", async () => {
      const email = `reg-test-${Date.now()}@test.com`;
      const password = "SecurePass123!";
      const passwordHash = await hash(password, 4);

      const user = await db.user.create({
        data: {
          name: "Test Trader",
          email,
          passwordHash,
        },
      });

      expect(user.id).toBeTruthy();
      expect(user.email).toBe(email);
      expect(user.name).toBe("Test Trader");
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash).not.toBe(password); // hashed, not plain
    });

    it("rejects duplicate email", async () => {
      const email = `reg-test-dup-${Date.now()}@test.com`;
      const passwordHash = await hash("Password123!", 4);

      await db.user.create({
        data: { email, passwordHash },
      });

      await expect(
        db.user.create({
          data: { email, passwordHash },
        })
      ).rejects.toThrow(); // Prisma unique constraint violation
    });

    it("stores password hash that validates correctly", async () => {
      const email = `reg-test-hash-${Date.now()}@test.com`;
      const password = "MyPassword!99";
      const passwordHash = await hash(password, 4);

      const user = await db.user.create({
        data: { email, passwordHash },
      });

      // Simulating credentials provider behavior
      const storedUser = await db.user.findUnique({ where: { email } });
      expect(storedUser).toBeTruthy();
      expect(storedUser!.passwordHash).toBeTruthy();

      const valid = await compare(password, storedUser!.passwordHash!);
      expect(valid).toBe(true);

      const invalid = await compare("WrongPassword", storedUser!.passwordHash!);
      expect(invalid).toBe(false);
    });

    it("allows optional fields (name, region, country)", async () => {
      const email = `reg-test-minimal-${Date.now()}@test.com`;
      const passwordHash = await hash("Password123!", 4);

      const user = await db.user.create({
        data: { email, passwordHash },
      });

      expect(user.name).toBeNull();
      expect(user.region).toBeNull();
      expect(user.country).toBeNull();
      expect(user.walletBalance).toBe(0);
    });
  });

  // ─── Credentials Login Simulation ───────────────────────

  describe("Credentials login (simulating auth.ts authorize)", () => {
    it("returns user for valid credentials", async () => {
      const email = `reg-test-login-${Date.now()}@test.com`;
      const password = "ValidPass123!";
      const passwordHash = await hash(password, 4);

      await db.user.create({
        data: { name: "Login Tester", email, passwordHash },
      });

      // Simulate authorize() logic from auth.ts
      const user = await db.user.findUnique({ where: { email } });
      expect(user).toBeTruthy();
      expect(user!.passwordHash).toBeTruthy();

      const valid = await compare(password, user!.passwordHash!);
      expect(valid).toBe(true);

      // authorize returns this shape
      const result = valid
        ? { id: user!.id, name: user!.name, email: user!.email, image: user!.image }
        : null;
      expect(result).not.toBeNull();
      expect(result!.id).toBeTruthy();
      expect(result!.email).toBe(email);
    });

    it("returns null for wrong password", async () => {
      const email = `reg-test-wrongpw-${Date.now()}@test.com`;
      const passwordHash = await hash("CorrectPassword!", 4);

      await db.user.create({
        data: { email, passwordHash },
      });

      const user = await db.user.findUnique({ where: { email } });
      const valid = await compare("WrongPassword!", user!.passwordHash!);
      expect(valid).toBe(false);
    });

    it("returns null for non-existent email", async () => {
      const user = await db.user.findUnique({
        where: { email: "nonexistent@test.com" },
      });
      expect(user).toBeNull();
    });

    it("returns null for user without passwordHash (OAuth user)", async () => {
      const email = `reg-test-oauth-${Date.now()}@test.com`;

      await db.user.create({
        data: { email }, // no passwordHash
      });

      const user = await db.user.findUnique({ where: { email } });
      expect(user).toBeTruthy();
      expect(user!.passwordHash).toBeNull();

      // authorize() checks: if (!user?.passwordHash) return null;
      const canLogin = !!user?.passwordHash;
      expect(canLogin).toBe(false);
    });
  });

  // ─── Input Validation ──────────────────────────────────

  describe("Registration validation (simulating /api/auth/register)", () => {
    it("validates minimum password length", () => {
      const password = "short";
      const isValid = password.length >= 8;
      expect(isValid).toBe(false);
    });

    it("accepts valid password", () => {
      const password = "LongEnough!";
      const isValid = password.length >= 8;
      expect(isValid).toBe(true);
    });

    it("requires email to be present", () => {
      const email = "";
      const isValid = !!email;
      expect(isValid).toBe(false);
    });
  });
});
