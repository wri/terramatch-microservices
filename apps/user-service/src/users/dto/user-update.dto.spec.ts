import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UserUpdateAttributes } from "./user-update.dto";

describe("UserUpdateAttributes", () => {
  it("accepts a list of valid roles", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: ["admin-super", "funder"] }));
    expect(errors).toHaveLength(0);
  });

  it("accepts an empty list of roles", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: [] }));
    expect(errors).toHaveLength(0);
  });

  it("rejects unknown roles", async () => {
    const errors = await validate(plainToInstance(UserUpdateAttributes, { roles: ["funder", "not-a-role"] }));
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
