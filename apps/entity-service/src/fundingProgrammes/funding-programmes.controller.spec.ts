import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { FundingProgrammesController } from "./funding-programmes.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { FundingProgramme, Stage } from "@terramatch-microservices/database/entities";
import {
  FormFactory,
  FundingProgrammeFactory,
  OrganisationFactory,
  OrganisationUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserId, serialize } from "@terramatch-microservices/common/util/testing";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { StoreFundingProgrammeAttributes } from "./dto/funding-programme.dto";
import { faker } from "@faker-js/faker";
import { FUNDING_PROGRAMME_STATUSES } from "@terramatch-microservices/database/constants/status";
import { FRAMEWORK_KEYS, ORGANISATION_TYPES, OrganisationType } from "@terramatch-microservices/database/constants";

describe("FundingProgrammesController", () => {
  let controller: FundingProgrammesController;
  let formDataService: DeepMocked<FormDataService>;
  let policyService: DeepMocked<PolicyService>;
  let localizationService: DeepMocked<LocalizationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FundingProgrammesController],
      providers: [
        { provide: FormDataService, useValue: (formDataService = createMock<FormDataService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: LocalizationService, useValue: (localizationService = createMock<LocalizationService>()) }
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
        await FundingProgrammeFactory.create({
          organisationTypes: ["for-profit", "non-profit"] as unknown as OrganisationType[]
        }),
        await FundingProgrammeFactory.create({ organisationTypes: ["non-profit"] as unknown as OrganisationType[] }),
        await FundingProgrammeFactory.create({ organisationTypes: ["gov"] as unknown as OrganisationType[] })
      ];
      await FundingProgrammeFactory.create({
        organisationTypes: ["non-profit-other"] as unknown as OrganisationType[]
      });
      await FundingProgrammeFactory.create({ organisationTypes: ["for-profit"] as unknown as OrganisationType[] });

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

  describe("createFundingProgramme", () => {
    it("creates the funding programme", async () => {
      const stageForms = await FormFactory.createMany(2);
      const attributes: StoreFundingProgrammeAttributes = {
        name: faker.company.name(),
        description: faker.lorem.sentence(),
        location: faker.location.city(),
        readMoreUrl: faker.internet.url(),
        status: faker.helpers.arrayElement(FUNDING_PROGRAMME_STATUSES),
        framework: faker.helpers.arrayElement(FRAMEWORK_KEYS),
        organisationTypes: [faker.helpers.arrayElement(ORGANISATION_TYPES)],

        stages: [
          { name: faker.company.name(), deadlineAt: faker.date.future(), formUuid: stageForms[0].uuid },
          { name: faker.company.name(), deadlineAt: faker.date.future(), formUuid: stageForms[1].uuid }
        ]
      };

      localizationService.generateI18nId.mockResolvedValue(1);

      await controller.createFundingProgramme({ data: { type: "fundingProgrammes", attributes } });
      const fp = await FundingProgramme.findOne({ order: [["createdAt", "DESC"]], attributes: ["uuid"] });
      const stages = await Stage.findAll({ where: { fundingProgrammeId: fp?.uuid }, order: [["order", "ASC"]] });
      await Promise.all(stageForms.map(form => form.reload()));

      expect(policyService.authorize).toHaveBeenCalledWith("create", FundingProgramme);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.name);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.description);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.location);
      expect(stages.length).toBe(2);
      expect(stageForms[0].stageId).toBe(stages[0].uuid);
      expect(stageForms[0].frameworkKey).toBe(attributes.framework);
      expect(stageForms[1].stageId).toBe(stages[1].uuid);
      expect(stageForms[1].frameworkKey).toBe(attributes.framework);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(expect.anything(), [
        expect.objectContaining({
          name: attributes.name,
          description: attributes.description,
          location: attributes.location,
          readMoreUrl: attributes.readMoreUrl,
          status: attributes.status,
          frameworkKey: attributes.framework,
          organisationTypes: attributes.organisationTypes
        })
      ]);
    });
  });
});
