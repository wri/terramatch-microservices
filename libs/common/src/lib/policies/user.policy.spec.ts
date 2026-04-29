import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { expectCan, expectCannot } from "./policy.service.spec";
import { User } from "@terramatch-microservices/database/entities";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { mockRequestContext } from "../util/testing";

describe("UserPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);

    mockRequestContext({ userId: 123 });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("allows reading any user as admin", async () => {
    mockRequestContext({ userId: 123, permissions: ["users-manage"] });
    await expectCan(service, "read", new User());
  });

  it("allows reading all users as admin", async () => {
    mockRequestContext({ userId: 123, permissions: ["users-manage"] });
    await expectCan(service, "readAll", User);
  });

  it("allows creating users as admin", async () => {
    mockRequestContext({ userId: 123, permissions: ["users-manage"] });
    await expectCan(service, "create", User);
  });

  it("disallows creating users as non-admin", async () => {
    await expectCannot(service, "create", User);
  });

  it("disallows reading other users as non-admin", async () => {
    await expectCannot(service, "read", new User());
  });

  it("allows reading own user as non-admin", async () => {
    await expectCan(service, "read", await UserFactory.build({ id: 123 }));
  });

  it("allows updating any user as admin", async () => {
    mockRequestContext({ userId: 123, permissions: ["users-manage"] });
    await expectCan(service, "update", new User());
  });

  it("disallows updating other users as non-admin", async () => {
    await expectCannot(service, "update", new User());
  });

  it("allows updating own user as non-admin", async () => {
    await expectCan(service, "update", await UserFactory.build({ id: 123 }));
  });

  it("allows verify any user with users-manage", async () => {
    mockRequestContext({ userId: 123, permissions: ["users-manage"] });
    await expectCan(service, "verify", new User());
  });

  it("disallows verify other users as non-admin", async () => {
    await expectCannot(service, "verify", await UserFactory.build({ id: 999 }));
  });

  it("allows verify own user as non-admin", async () => {
    await expectCan(service, "verify", await UserFactory.build({ id: 123 }));
  });

  it("allows verify any user for verified admin without users-manage", async () => {
    const verifiedAdminUser = new User();
    (verifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = new Date();
    (verifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-terrafund" }];

    jest.spyOn(User, "findOne").mockResolvedValue(verifiedAdminUser);

    await expectCan(service, "verify", new User());
  });

  it("allows reading all users for verified admin without users-manage", async () => {
    const verifiedAdminUser = new User();
    (verifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = new Date();
    (verifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-terrafund" }];

    jest.spyOn(User, "findOne").mockResolvedValue(verifiedAdminUser);

    await expectCan(service, "readAll", User);
  });

  it("allows updating any user for verified admin without users-manage", async () => {
    const verifiedAdminUser = new User();
    (verifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = new Date();
    (verifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-terrafund" }];

    jest.spyOn(User, "findOne").mockResolvedValue(verifiedAdminUser);

    await expectCan(service, "update", new User());
  });

  it("disallows verify any user when admin role is unverified", async () => {
    const unverifiedAdminUser = new User();
    (unverifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = null;
    (unverifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-terrafund" }];

    jest.spyOn(User, "findOne").mockResolvedValue(unverifiedAdminUser);

    await expectCannot(service, "verify", await UserFactory.build({ id: 999 }));
  });

  it("disallows verify any user when verified user has no admin role", async () => {
    const verifiedNonAdminUser = new User();
    (verifiedNonAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = new Date();
    (verifiedNonAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "project-manager" }];

    jest.spyOn(User, "findOne").mockResolvedValue(verifiedNonAdminUser);

    await expectCannot(service, "verify", await UserFactory.build({ id: 999 }));
  });

  it("disallows verify any user when authenticated user is not found", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);

    await expectCannot(service, "verify", await UserFactory.build({ id: 999 }));
  });

  it("allows deleting any user as users-manage", async () => {
    mockRequestContext({ userId: 123, permissions: ["users-manage"] });
    await expectCan(service, "delete", new User());
  });

  it("disallows deleting users as non-admin", async () => {
    await expectCannot(service, "delete", new User());
    await expectCannot(service, "delete", await UserFactory.build({ id: 123 }));
  });

  it("allows deleting any user for verified admin without users-manage", async () => {
    const verifiedAdminUser = new User();
    (verifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = new Date();
    (verifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-terrafund" }];

    jest.spyOn(User, "findOne").mockResolvedValue(verifiedAdminUser);

    await expectCan(service, "delete", new User());
  });
});
