import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { FundingProgrammesController } from "./funding-programmes.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { FundingProgramme, SavedExport, Stage } from "@terramatch-microservices/database/entities";
import {
  FormFactory,
  FundingProgrammeFactory,
  OrganisationFactory,
  OrganisationUserFactory,
  SavedExportFactory,
  StageFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import {
  mockRequestContext,
  mockRequestForUser,
  serialize,
  setMockedPermissions
} from "@terramatch-microservices/common/util/testing";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { StoreFundingProgrammeAttributes } from "./dto/funding-programme.dto";
import { faker } from "@faker-js/faker";
import { FUNDING_PROGRAMME_STATUSES } from "@terramatch-microservices/database/constants/status";
import { FRAMEWORK_KEYS, ORGANISATION_TYPES, OrganisationType } from "@terramatch-microservices/database/constants";
import { NotFoundException } from "@nestjs/common";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { DateTime } from "luxon";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";

describe("FundingProgrammesController", () => {
  let controller: FundingProgrammesController;
  let formDataService: DeepMocked<FormDataService>;
  let policyService: PolicyService;
  let localizationService: DeepMocked<LocalizationService>;
  let csvExportService: DeepMocked<CsvExportService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FundingProgrammesController],
      providers: [
        PolicyService,
        { provide: FormDataService, useValue: (formDataService = createMock<FormDataService>()) },
        { provide: LocalizationService, useValue: (localizationService = createMock<LocalizationService>()) },
        { provide: CsvExportService, useValue: (csvExportService = createMock<CsvExportService>()) }
      ]
    }).compile();

    policyService = module.get(PolicyService);
    controller = module.get(FundingProgrammesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("indexFundingProgrammes", () => {
    it("returns all funding programmes", async () => {
      await FundingProgramme.truncate();
      setMockedPermissions("framework-terrafund");
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();
      const programmes = await FundingProgrammeFactory.createMany(3);
      await controller.index({ translated: false });
      expect(authSpy).toHaveBeenCalledWith(
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
      mockRequestForUser(user, "manage-own");
      await FundingProgrammeFactory.createMany(3);
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();
      await controller.index({ translated: false });
      expect(authSpy).toHaveBeenCalledWith("read", []);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(expect.anything(), [], undefined);
    });

    it("returns the funding programmes related to the user's org", async () => {
      const org = await OrganisationFactory.create({ type: "non-profit" });
      const org2 = await OrganisationFactory.create({ type: "gov" });
      const user = await UserFactory.create({ organisationId: org.id });
      await OrganisationUserFactory.create({ organisationId: org2.id, userId: user.id, status: "approved" });
      mockRequestForUser(user, "manage-own");
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

      const authSpy = jest.spyOn(policyService, "authorize");

      await controller.index({ translated: false });

      expect(authSpy).toHaveBeenCalledWith(
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
      mockRequestForUser(user, "framework-ppc");
      await controller.index({});
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "es-MX"
      );
    });
  });

  describe("getFundingProgramme", () => {
    it("throws if the programme is not found", async () => {
      await expect(controller.get({ uuid: "fake-uuid" }, {})).rejects.toThrow("Funding programme not found");
    });

    it("returns the programme UUID", async () => {
      const programme = await FundingProgrammeFactory.create();
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();
      await controller.get({ uuid: programme.uuid }, { translated: false });
      await programme.reload();
      expect(authSpy).toHaveBeenCalledWith("read", programme);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ uuid: programme.uuid })]),
        undefined
      );
    });

    it("translates by default", async () => {
      const programme = await FundingProgrammeFactory.create();
      const user = await UserFactory.create({ locale: "es-MX" });
      mockRequestForUser(user);
      await controller.get({ uuid: programme.uuid }, {});
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
      await expect(controller.delete({ uuid: "fake-uuid" })).rejects.toThrow("Funding programme not found");
    });

    it("deletes the programme", async () => {
      const programme = await FundingProgrammeFactory.create();
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();

      const result = serialize(await controller.delete({ uuid: programme.uuid }));
      await programme.reload({ paranoid: false });

      expect(authSpy).toHaveBeenCalledWith("delete", expect.objectContaining({ id: programme.id }));
      await expect(programme.deletedAt).not.toBeNull();
      expect(result.meta.resourceType).toBe("fundingProgrammes");
      expect(result.meta.resourceIds).toEqual([programme.uuid]);
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
        frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
        organisationTypes: [faker.helpers.arrayElement(ORGANISATION_TYPES)],

        stages: [
          { name: faker.company.name(), deadlineAt: faker.date.future(), formUuid: stageForms[0].uuid },
          { name: faker.company.name(), deadlineAt: faker.date.future(), formUuid: stageForms[1].uuid }
        ]
      };

      localizationService.generateI18nId.mockResolvedValue(1);
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();

      await controller.create({ data: { type: "fundingProgrammes", attributes } });
      const fp = await FundingProgramme.findOne({ order: [["createdAt", "DESC"]], attributes: ["uuid"] });
      const stages = await Stage.findAll({ where: { fundingProgrammeId: fp?.uuid }, order: [["order", "ASC"]] });
      await Promise.all(stageForms.map(form => form.reload()));

      expect(authSpy).toHaveBeenCalledWith(
        "create",
        expect.objectContaining({ name: attributes.name, frameworkKey: attributes.frameworkKey })
      );
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.name);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.description);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.location);
      expect(stages.length).toBe(2);
      expect(stageForms[0].stageId).toBe(stages[0].uuid);
      expect(stageForms[0].frameworkKey).toBe(attributes.frameworkKey);
      expect(stageForms[1].stageId).toBe(stages[1].uuid);
      expect(stageForms[1].frameworkKey).toBe(attributes.frameworkKey);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(expect.anything(), [
        expect.objectContaining({
          name: attributes.name,
          description: attributes.description,
          location: attributes.location,
          readMoreUrl: attributes.readMoreUrl,
          status: attributes.status,
          frameworkKey: attributes.frameworkKey,
          organisationTypes: attributes.organisationTypes
        })
      ]);
    });
  });

  describe("updateFundingProgramme", () => {
    it("throws if the programme is not found", async () => {
      await expect(
        controller.update(
          { uuid: "fake-uuid" },
          { data: { id: "fake-uuid", type: "fundingProgrammes", attributes: {} as StoreFundingProgrammeAttributes } }
        )
      ).rejects.toThrow("Funding programme not found");
    });

    it("throws if the path and payload UUIDs don't match", async () => {
      await expect(
        controller.update(
          { uuid: "fake-id-1" },
          { data: { id: "fake-id-2", type: "fundingProgrammes", attributes: {} as StoreFundingProgrammeAttributes } }
        )
      ).rejects.toThrow("Funding programme id in path and payload do not match");
    });

    it("updates the funding programme", async () => {
      const programme = await FundingProgrammeFactory.create();
      const currentStages = await Promise.all([
        StageFactory.create({ fundingProgrammeId: programme.uuid, order: 1 }),
        StageFactory.create({ fundingProgrammeId: programme.uuid, order: 2 })
      ]);
      const currentForms = await Promise.all(
        currentStages.map(stage => FormFactory.create({ stageId: stage.uuid, frameworkKey: programme.frameworkKey }))
      );

      const updateStageForm = await FormFactory.create();
      const attributes: StoreFundingProgrammeAttributes = {
        name: programme.name,
        description: faker.lorem.sentence(),
        location: faker.location.city(),
        readMoreUrl: faker.internet.url(),
        status: faker.helpers.arrayElement(FUNDING_PROGRAMME_STATUSES),
        frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
        organisationTypes: [faker.helpers.arrayElement(ORGANISATION_TYPES)],

        stages: [
          // make the current second stage be the new first stage to test order set, and have it use the previous first stage's form.
          {
            uuid: currentStages[1].uuid,
            name: faker.company.name(),
            deadlineAt: faker.date.future(),
            formUuid: currentForms[0].uuid
          },
          { name: faker.company.name(), deadlineAt: faker.date.future(), formUuid: updateStageForm.uuid }
        ]
      };

      localizationService.generateI18nId.mockResolvedValue(1);
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();

      await controller.update(
        { uuid: programme.uuid },
        { data: { id: programme.uuid, type: "fundingProgrammes", attributes } }
      );
      await programme.reload();
      const updateStages = await Stage.findAll({
        where: { fundingProgrammeId: programme.uuid },
        order: [["order", "ASC"]]
      });
      await Promise.all(
        [...currentStages, ...currentForms, updateStageForm].map(model => model.reload({ paranoid: false }))
      );

      expect(authSpy).toHaveBeenCalledWith("update", expect.objectContaining({ uuid: programme.uuid }));
      expect(localizationService.generateI18nId).toHaveBeenCalledTimes(2);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.description);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.location);
      expect(updateStages.length).toBe(2);
      expect(updateStages[0].uuid).toBe(currentStages[1].uuid);
      expect(currentStages[0].deletedAt).not.toBeNull();
      expect(currentForms[0].stageId).toBe(updateStages[0].uuid);
      expect(currentForms[1].stageId).toBeNull();
      expect(updateStageForm.stageId).toBe(updateStages[1].uuid);
      expect(updateStageForm.frameworkKey).toBe(programme.frameworkKey);
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(expect.anything(), [
        expect.objectContaining({
          name: attributes.name,
          description: attributes.description,
          location: attributes.location,
          readMoreUrl: attributes.readMoreUrl,
          status: attributes.status,
          frameworkKey: attributes.frameworkKey,
          organisationTypes: attributes.organisationTypes
        })
      ]);
    });
  });

  describe("exportAll", () => {
    it("throws if the export is not found", async () => {
      await SavedExport.truncate();
      mockRequestContext({ userId: 123, permissions: ["framework-ppc"] });
      await expect(controller.exportAll({ uuid: "uuid" })).rejects.toThrow(NotFoundException);
    });

    it("returns the saved export url", async () => {
      const fp = await FundingProgrammeFactory.create();
      const exports = await SavedExportFactory.createMany(2, { fundingProgrammeId: fp.id });
      exports[0].setDataValue("createdAt", DateTime.fromJSDate(exports[0].createdAt).minus({ days: 1 }).toJSDate());
      await exports[0].save();

      mockRequestContext({ userId: 123, permissions: ["framework-ppc"] });
      csvExportService.generateExportDto.mockResolvedValue(new FileDownloadDto("test"));
      await controller.exportAll({ uuid: fp.uuid });
      expect(csvExportService.generateExportDto).toHaveBeenCalledWith(exports[1].name);
    });
  });
});
