import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { mockRequestContext } from "../util/testing";
import { FundingProgrammeFactory } from "@terramatch-microservices/database/factories";

describe("FundingProgrammePolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("allows uploading files with framework permissions", async () => {
    mockRequestContext({ userId: 123, permissions: ["framework-ppc"] });
    let fp = await FundingProgrammeFactory.create({ frameworkKey: "ppc" });
    await expectCan(service, "uploadFiles", fp);
    fp = await FundingProgrammeFactory.create({ frameworkKey: "terrafund" });
    await expectCannot(service, "uploadFiles", fp);
  });
});
