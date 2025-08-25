import { OrganisationsController } from "./organisations.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { OrganisationCreationService } from "./organisation-creation.service";
import { UnauthorizedException } from "@nestjs/common";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";

const createRequest = (attributes: OrganisationCreateAttributes = new OrganisationCreateAttributes()) => ({
  data: { type: "organisations", attributes }
});

describe("OrganisationsController", () => {
  let controller: OrganisationsController;
  let policyService: DeepMocked<PolicyService>;
  let creationService: DeepMocked<OrganisationCreationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrganisationsController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: OrganisationCreationService,
          useValue: (creationService = createMock<OrganisationCreationService>())
        }
      ]
    }).compile();

    controller = module.get(OrganisationsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.create(createRequest())).rejects.toThrow(UnauthorizedException);
    });

    it("should call the creation service", async () => {
      const attrs = new OrganisationCreateAttributes();
      await controller.create(createRequest(attrs));
      expect(creationService.createOrganisation).toHaveBeenCalledWith(attrs);
    });
  });
});
