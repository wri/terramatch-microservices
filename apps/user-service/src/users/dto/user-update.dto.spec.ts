import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UserUpdateAttributes } from "./user-update.dto";

describe("UserUpdateAttributes", () => {
  it("accepts a single role", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: ["admin-super"] }));
    expect(errors).toHaveLength(0);
  });

  it("accepts multiple framework admin roles", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: ["admin-ppc", "admin-terrafund"] }));
    expect(errors).toHaveLength(0);
  });

  it.each(["project-developer", "admin-super", "government", "funder", "project-manager"])(
    "rejects %s combined with another role",
    async role => {
      const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: ["admin-ppc", role] }));
      expect(errors.map(({ property }) => property)).toEqual(["roles"]);
    }
  );

  it("rejects an empty list of roles", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: [] }));
    expect(errors.map(({ property }) => property)).toEqual(["roles"]);
  });

  it("accepts an update that leaves roles out", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { firstName: "New" }));
    expect(errors).toHaveLength(0);
  });

  it("rejects unknown roles", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: ["not-a-role"] }));
    expect(errors.map(({ property }) => property)).toEqual(["roles"]);
  });

  it("rejects a single role string", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: "funder" }));
    expect(errors.map(({ property }) => property)).toEqual(["roles"]);
  });

  it("accepts a list of valid direct frameworks", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { directFrameworks: ["ppc", "terrafund-3"] }));
    expect(errors).toHaveLength(0);
  });

  it("rejects unknown direct frameworks", async () => {
    const errors = await validate(
      plainToInstance(UserUpdateAttributes, { directFrameworks: ["ppc", "not-a-framework"] })
    );
    expect(errors.map(({ property }) => property)).toEqual(["directFrameworks"]);
  });
});
