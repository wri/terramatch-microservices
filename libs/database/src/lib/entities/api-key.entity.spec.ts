import { ApiKey } from "./api-key.entity";
import { ApiKeyFactory, UserFactory } from "../factories";
import { DateTime } from "luxon";

describe("ApiKey", () => {
  describe("findUser", () => {
    it("returns the user with the requested attributes for a non-expiring key", async () => {
      const { key, userId } = await ApiKeyFactory.create();
      const user = await ApiKey.findUser(key, ["id", "locale"]);
      expect(user?.id).toBe(userId);
      expect(user?.locale).toBeDefined();
      expect(user?.emailAddress).toBeUndefined();
    });

    it("loads all user attributes by default", async () => {
      const { key, userId } = await ApiKeyFactory.create();
      const user = await ApiKey.findUser(key);
      expect(user?.id).toBe(userId);
      expect(user?.emailAddress).toBeDefined();
    });

    it("returns the user for a key that has not yet expired", async () => {
      const { key, userId } = await ApiKeyFactory.create({ expiresAt: DateTime.now().plus({ days: 1 }).toJSDate() });
      expect((await ApiKey.findUser(key, ["id"]))?.id).toBe(userId);
    });

    it("returns null for an expired key", async () => {
      const { key } = await ApiKeyFactory.create({ expiresAt: DateTime.now().minus({ days: 1 }).toJSDate() });
      expect(await ApiKey.findUser(key, ["id"])).toBeNull();
    });

    it("returns null for a key that belongs to a deleted user", async () => {
      const user = await UserFactory.create();
      const { key } = await ApiKeyFactory.create({ userId: user.id });
      await user.destroy();
      expect(await ApiKey.findUser(key, ["id"])).toBeNull();
    });

    it("returns null for an unknown key", async () => {
      expect(await ApiKey.findUser(ApiKey.generateKey())).toBeNull();
    });
  });

  describe("rotate", () => {
    it("expires the existing key after the default week and creates a new non-expiring key", async () => {
      const user = await UserFactory.create();
      const existing = await ApiKeyFactory.create({ userId: user.id });

      const rotated = await ApiKey.rotate(user.id);

      expect(rotated.key).not.toEqual(existing.key);
      expect(rotated.expiresAt ?? null).toBeNull();
      await existing.reload();
      const expectedExpiration = DateTime.now().plus({ weeks: 1 });
      expect(
        Math.abs(
          DateTime.fromJSDate(existing.expiresAt as Date)
            .diff(expectedExpiration)
            .as("minutes")
        )
      ).toBeLessThan(1);
      expect((await ApiKey.findUser(existing.key, ["id"]))?.id).toBe(user.id);
      expect((await ApiKey.findUser(rotated.key, ["id"]))?.id).toBe(user.id);
    });

    it("uses the provided expiration and leaves already-expiring keys alone", async () => {
      const user = await UserFactory.create();
      const alreadyExpiring = await ApiKeyFactory.create({
        userId: user.id,
        expiresAt: DateTime.now().plus({ hours: 1 }).toJSDate()
      });
      const existing = await ApiKeyFactory.create({ userId: user.id });
      // The DB truncates milliseconds, so compare against the stored value.
      const originalExpiration = (await alreadyExpiring.reload()).expiresAt;

      await ApiKey.rotate(user.id, { expiresIn: { days: 1 } });

      await alreadyExpiring.reload();
      expect(alreadyExpiring.expiresAt).toEqual(originalExpiration);
      await existing.reload();
      expect(
        Math.abs(
          DateTime.fromJSDate(existing.expiresAt as Date)
            .diff(DateTime.now().plus({ days: 1 }))
            .as("minutes")
        )
      ).toBeLessThan(1);
    });

    it("uses the provided key", async () => {
      const user = await UserFactory.create();
      const key = ApiKey.generateKey();
      const rotated = await ApiKey.rotate(user.id, { key });
      expect(rotated.key).toEqual(key);
      expect((await ApiKey.findUser(key, ["id"]))?.id).toBe(user.id);
    });

    it("creates a key for a user that has none", async () => {
      const user = await UserFactory.create();
      const rotated = await ApiKey.rotate(user.id);
      expect((await ApiKey.findUser(rotated.key, ["id"]))?.id).toBe(user.id);
    });
  });
});
