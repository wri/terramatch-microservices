import { User } from "./user.entity";

describe("User", () => {
  describe("canReviewPolygons", () => {
    it.each([
      [["admin-super"], true],
      [["admin-terrafund"], true],
      [["project-manager"], true],
      [["project-developer"], false],
      [["greenhouse-service-account"], false],
      [["funder"], false]
    ])("returns the expected value for %j", (roles, expected) => {
      const user = new User();
      user.roles = roles;
      expect(user.canReviewPolygons).toBe(expected);
    });
  });
});
