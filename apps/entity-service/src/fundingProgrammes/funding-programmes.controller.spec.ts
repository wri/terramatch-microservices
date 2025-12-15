import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { FundingProgrammesController } from "./funding-programmes.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { FundingProgramme } from "@terramatch-microservices/database/entities";
import {
  FundingProgrammeFactory,
  OrganisationFactory,
  OrganisationUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserId, serialize } from "@terramatch-microservices/common/util/testing";

describe("FundingProgrammesController", () => {
  let controller: FundingProgrammesController;
  let formDataService: DeepMocked<FormDataService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FundingProgrammesController],
      providers: [
        { provide: FormDataService, useValue: (formDataService = createMock<FormDataService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(FundingProgrammesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("indexFundingProgrammes", () => {
    it("returns all funding programmes", async () => {
      await FundingProgramme.truncate();
      policyService.getPermissions.mockResolvedValue(["framework-terrafund"]);
      const programmes = await FundingProgrammeFactory.createMany(3);
      await controller.indexFundingProgrammes({ translated: false });
      expect(policyService.authorize).toHaveBeenCalledWith(
        "read",
        expect.arrayContaining(programmes.map(({ uuid }) => expect.objectContaining({ uuid })))
      );
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.objectContaining({ options: { forceDataArray: true } }),
        expect.arrayContaining(programmes.map(({ uuid }) => expect.objectContaining({ uuid }))),
        undefined
      );
    });

    it("returns no funding programmes if the user doesn't have an org", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await FundingProgrammeFactory.createMany(3);
      await controller.indexFundingProgrammes({ translated: false });
      expect(policyService.authorize).toHaveBeenCalledWith("read", []);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(expect.anything(), [], undefined);
    });

    it("returns the funding programmes related to the user's org", async () => {
      const org = await OrganisationFactory.create({ type: "non-profit" });
      const org2 = await OrganisationFactory.create({ type: "gov" });
      const user = await UserFactory.create({ organisationId: org.id });
      await OrganisationUserFactory.create({ organisationId: org2.id, userId: user.id, status: "approved" });
      mockUserId(user.id);
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await FundingProgramme.truncate();
      const programmes = [
        await FundingProgrammeFactory.create({ organisationTypes: ["for-profit", "non-profit"] }),
        await FundingProgrammeFactory.create({ organisationTypes: ["non-profit"] }),
        await FundingProgrammeFactory.create({ organisationTypes: ["gov"] })
      ];
      await FundingProgrammeFactory.create({ organisationTypes: ["non-profit-other"] });
      await FundingProgrammeFactory.create({ organisationTypes: ["for-profit"] });

      await controller.indexFundingProgrammes({ translated: false });

      expect(policyService.authorize).toHaveBeenCalledWith(
        "read",
        expect.arrayContaining(programmes.map(({ uuid }) => expect.objectContaining({ uuid })))
      );
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.objectContaining({ options: { forceDataArray: true } }),
        expect.arrayContaining(programmes.map(({ uuid }) => expect.objectContaining({ uuid }))),
        undefined
      );
    });

    it("translates by default", async () => {
      await FundingProgramme.truncate();
      const user = await UserFactory.create({ locale: "es-MX" });
      mockUserId(user.id);
      await controller.indexFundingProgrammes({});
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "es-MX"
      );
    });
  });

  describe("getFundingProgramme", () => {
    it("throws if the programme is not found", async () => {
      await expect(controller.getFundingProgramme({ uuid: "fake-uuid" }, {})).rejects.toThrow(
        "Funding programme not found"
      );
    });

    it("returns the programme UUID", async () => {
      const programme = await FundingProgrammeFactory.create();
      await controller.getFundingProgramme({ uuid: programme.uuid }, { translated: false });
      await programme.reload();
      expect(policyService.authorize).toHaveBeenCalledWith("read", programme);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ uuid: programme.uuid })]),
        undefined
      );
    });

    it("translates by default", async () => {
      const programme = await FundingProgrammeFactory.create();
      const user = await UserFactory.create({ locale: "es-MX" });
      mockUserId(user.id);
      await controller.getFundingProgramme({ uuid: programme.uuid }, {});
      await programme.reload();
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ uuid: programme.uuid })]),
        "es-MX"
      );
    });
  });

  describe("deleteFundingProgramme", () => {
    it("throws if the programme is not found", async () => {
      await expect(controller.deleteFundingProgramme({ uuid: "fake-uuid" })).rejects.toThrow(
        "Funding programme not found"
      );
    });

    it("deletes the programme", async () => {
      const programme = await FundingProgrammeFactory.create();

      const result = serialize(await controller.deleteFundingProgramme({ uuid: programme.uuid }));
      await programme.reload({ paranoid: false });

      expect(policyService.authorize).toHaveBeenCalledWith("delete", expect.objectContaining({ id: programme.id }));
      await expect(programme.deletedAt).not.toBeNull();
      expect(result.meta.resourceType).toBe("fundingProgrammes");
      expect(result.meta.resourceId).toBe(programme.uuid);
    });
  });
});
