import { Test } from "@nestjs/testing";
import { PolygonAttributeDefinitionFactory } from "@terramatch-microservices/database/factories";
import { PolicyService } from "./policy.service";
import { expectCan, expectCannot } from "./policy.service.spec";
import { mockUserContext } from "../util/testing";

describe("PolygonAttributeDefinitionPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("allows CRUD for the user's frameworks and denies others", async () => {
    mockUserContext({ userId: 123, permissions: ["framework-ppc"] });
    const ppc = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
    const terrafund = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "terrafund" });

    await expectCan(service, ["read", "create", "update", "delete"], ppc);
    await expectCannot(service, ["read", "create", "update", "delete"], terrafund);
  });

  it("denies all actions when the user has no framework permissions", async () => {
    mockUserContext({ userId: 123, permissions: [] });
    const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });

    await expectCannot(service, ["read", "create", "update", "delete"], definition);
  });
});
