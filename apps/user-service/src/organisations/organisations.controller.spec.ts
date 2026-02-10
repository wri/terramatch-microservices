import { OrganisationsController } from "./organisations.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { OrganisationsService } from "./organisations.service";
import { UnauthorizedException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import {
  ApplicationFactory,
  FundingProgrammeFactory,
  OrganisationFactory
} from "@terramatch-microservices/database/factories";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";

const createRequest = (attributes: OrganisationCreateAttributes = new OrganisationCreateAttributes()) => ({
  data: { type: "organisations", attributes }
});

describe("OrganisationsController", () => {
  let controller: OrganisationsController;
  let policyService: DeepMocked<PolicyService>;
  let organisationsService: DeepMocked<OrganisationsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrganisationsController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: OrganisationsService,
          useValue: (organisationsService = createMock<OrganisationsService>())
        },
        { provide: getQueueToken("email"), useValue: createMock() },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    controller = module.get(OrganisationsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("throws if no funding programme filter is provided", async () => {
      await expect(controller.index({})).rejects.toThrow("Funding programme UUID is required");
    });

    it("returns orgs associated with a funding programme", async () => {
      const programme = await FundingProgrammeFactory.create();
      const orgs = await OrganisationFactory.createMany(3);
      await ApplicationFactory.create({ organisationUuid: orgs[0].uuid, fundingProgrammeUuid: programme.uuid });
      await ApplicationFactory.create({ organisationUuid: orgs[1].uuid, fundingProgrammeUuid: programme.uuid });

      const result = serialize(await controller.index({ fundingProgrammeUuid: programme.uuid }));

      expect(policyService.authorize).toHaveBeenCalledWith(
        "read",
        expect.arrayContaining(orgs.slice(0, 2).map(({ uuid }) => expect.objectContaining({ uuid })))
      );

      expect(result.meta.indices?.[0].total).toBe(2);
      expect(result.data).toHaveLength(2);
      const uuids = (result.data as Resource[]).map(({ id }) => id);
      expect(uuids).toContain(orgs[0].uuid);
      expect(uuids).toContain(orgs[1].uuid);
      expect(uuids).not.toContain(orgs[2].uuid);
    });
  });

  describe("create", () => {
    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.create(createRequest())).rejects.toThrow(UnauthorizedException);
    });

    it("should call the organisations service create method", async () => {
      const attrs = new OrganisationCreateAttributes();
      await controller.create(createRequest(attrs));
      expect(organisationsService.create).toHaveBeenCalledWith(attrs);
    });
  });
});
