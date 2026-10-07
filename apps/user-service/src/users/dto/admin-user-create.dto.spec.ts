import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AdminUserCreateAttributes } from "./admin-user-create.dto";

const attributes = (roles?: unknown) => ({
  firstName: "First",
  lastName: "Last",
  emailAddress: "person@example.com",
  directFrameworks: ["ppc"],
  roles
});

describe("AdminUserCreateAttributes", () => {
  it("accepts a list of valid roles", async () => {
    const errors = await validate(plainToInstance(AdminUserCreateAttributes, attributes(["admin-ppc", "funder"])));
    expect(errors).toHaveLength(0);
  });

  it("rejects an empty list of roles", async () => {
    const errors = await validate(plainToInstance(AdminUserCreateAttributes, attributes([])));
    expect(errors.map(({ property }) => property)).toEqual(["roles"]);
  });

  it("rejects missing roles", async () => {
    const errors = await validate(plainToInstance(AdminUserCreateAttributes, attributes()));
    expect(errors.map(({ property }) => property)).toEqual(["roles"]);
  });

  it("rejects unknown roles", async () => {
    const errors = await validate(plainToInstance(AdminUserCreateAttributes, attributes(["not-a-role"])));
    expect(errors.map(({ property }) => property)).toEqual(["roles"]);
  });
});
