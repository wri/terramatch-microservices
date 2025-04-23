import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { UnauthorizedException } from "@nestjs/common";
import { ModelHasRole, Permission, User } from "@terramatch-microservices/database/entities";
import { RequestContext } from "nestjs-request-context";
import { isArray } from "lodash";

export function mockUserId(userId?: number) {
  jest
    .spyOn(RequestContext, "currentContext", "get")
    .mockReturnValue({ req: { authenticatedUserId: userId }, res: {} });
}

export function mockPermissions(...permissions: string[]) {
  Permission.getUserPermissionNames = jest.fn().mockResolvedValue(permissions);
}

type Subject = Parameters<PolicyService["authorize"]>[1];
export async function expectCan(service: PolicyService, action: string | string[], subject: Subject) {
  const actions = isArray(action) ? action : [action];
  for (const action of actions) {
    await expect(service.authorize(action, subject)).resolves.toBeUndefined();
  }
}

export async function expectCannot(service: PolicyService, action: string | string[], subject: Subject) {
  const actions = isArray(action) ? action : [action];
  for (const action of actions) {
    await expect(service.authorize(action, subject)).rejects.toThrow(UnauthorizedException);
  }
}

type AuthorityTest = [string | string[], Subject];
type AuthorityTests = {
  can?: AuthorityTest[];
  cannot?: AuthorityTest[];
};
export async function expectAuthority(service: PolicyService, tests: AuthorityTests) {
  await Promise.all((tests.can ?? []).map(([action, subject]) => expectCan(service, action, subject)));
  await Promise.all((tests.cannot ?? []).map(([action, subject]) => expectCannot(service, action, subject)));
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
    await expect(service.getPermissions()).rejects.toThrow(UnauthorizedException);
  });

  it("should throw an error if there is no policy defined", async () => {
    mockUserId(123);
    await expect(service.authorize("foo", new ModelHasRole())).rejects.toThrow(UnauthorizedException);
  });
});
