import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { UnauthorizedException } from "@nestjs/common";
import { ModelHasRole, Permission, User } from "@terramatch-microservices/database/entities";
import { RequestContext } from "nestjs-request-context";

export function mockUserId(userId?: number) {
  jest
    .spyOn(RequestContext, "currentContext", "get")
    .mockReturnValue({ req: { authenticatedUserId: userId }, res: {} });
}

export function mockPermissions(...permissions: string[]) {
  Permission.getUserPermissionNames = jest.fn().mockResolvedValue(permissions);
}

describe("PolicyService", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve<PolicyService>(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("should throw an error if no authed user is found", async () => {
    mockUserId();
    await expect(service.authorize("foo", new User())).rejects.toThrow(UnauthorizedException);
  });

  it("should throw an error if there is no policy defined", async () => {
    mockUserId(123);
    await expect(service.authorize("foo", new ModelHasRole())).rejects.toThrow(UnauthorizedException);
  });
});
