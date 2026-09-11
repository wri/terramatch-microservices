import { NotFoundException, NotImplementedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { PolicyService } from "@terramatch-microservices/common";
import {
  FormFactory,
  FormQuestionFactory,
  FormSectionFactory,
  FundingProgrammeFactory,
  LocalizationKeyFactory,
  AboutSectionFactory,
  LinkFactory
} from "@terramatch-microservices/database/factories";
import { I18nTranslationFactory } from "@terramatch-microservices/database/factories/i18n-translation.factory";
import {
  AboutSection,
  Form,
  FundingProgramme,
  I18nItem,
  I18nTranslation,
  LocalizationKey
} from "@terramatch-microservices/database/entities";
import { mockUserContext } from "@terramatch-microservices/common/util/testing";
import { TransifexApiService } from "@terramatch-microservices/transifex-api";
import { EntityTranslationsService } from "./entity-translations.service";

jest.mock("@transifex/native", () => ({
  generateHashedKey: jest.fn().mockImplementation((value: string) => `hash:${value}`)
}));

describe("EntityTranslationsService", () => {
  let service: EntityTranslationsService;
  let policyService: PolicyService;
  let transifexApiService: DeepMocked<TransifexApiService>;

  beforeEach(async () => {
    await Form.truncate();
    await FundingProgramme.truncate();
    await LocalizationKey.truncate();
    await AboutSection.truncate();
    await I18nTranslation.truncate();
    await I18nItem.truncate();

    const module = await Test.createTestingModule({
      providers: [
        EntityTranslationsService,
        PolicyService,
        { provide: TransifexApiService, useValue: (transifexApiService = createMock<TransifexApiService>()) }
      ]
    }).compile();

    service = module.get(EntityTranslationsService);
    policyService = module.get(PolicyService);
    mockUserContext({ userId: 123, permissions: ["custom-forms-manage", "framework-ppc"] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("authorizeAndGetPushContext", () => {
    it("collects form labels including nested entities and tracking entry configs", async () => {
      const form = await FormFactory.create({ title: "Tracking Form" });
      const section = await FormSectionFactory.form(form).create({ title: "Section" });
      await FormQuestionFactory.section(section).create({
        label: "Workdays",
        inputType: "workdays",
        additionalProps: {
          entryConfigs: [
            {
              type: "gender",
              title: "Custom Gender",
              displayTrackingType: "People",
              addNameLabel: "Add Ethnic Group",
              subTypes: [{ subtype: "male", label: "Male" }]
            }
          ]
        }
      });

      const context = await service.authorizeAndGetPushContext("forms", form.uuid);
      expect(context.entityType).toBe("forms");
      expect(context.entityName).toBe("Tracking Form");
      expect(context.i18nLabels).toEqual(
        expect.arrayContaining([
          "Tracking Form",
          "Section",
          "Workdays",
          "Custom Gender",
          "People",
          "Add Ethnic Group",
          "Male",
          "By: Custom Gender",
          "Custom Gender Definition",
          "Number of People"
        ])
      );
    });

    it("collects funding programme I18N field labels only", async () => {
      const fundingProgramme = await FundingProgrammeFactory.create({
        name: "Programme Name",
        description: "Programme Description",
        location: "Programme Location",
        frameworkKey: "ppc"
      });

      const context = await service.authorizeAndGetPushContext("fundingProgrammes", fundingProgramme.uuid);
      expect(context.entityType).toBe("fundingProgrammes");
      expect(context.i18nLabels).toEqual(
        expect.arrayContaining(["Programme Name", "Programme Description", "Programme Location"])
      );
    });

    it("collects all localization key value labels without a uuid", async () => {
      await LocalizationKeyFactory.create({ key: "some.localization.key", value: "Translatable Value" });
      await LocalizationKeyFactory.create({ key: "another.localization.key", value: "Another Value" });

      const context = await service.authorizeAndGetPushContext("localizationKeys");
      expect(context.entityType).toBe("localizationKeys");
      expect(context.uuid).toBe("localizationKeys");
      expect(context.i18nLabels).toEqual(expect.arrayContaining(["Translatable Value", "Another Value"]));
      expect(context.i18nLabels).toHaveLength(2);
    });

    it("collects about section and link I18N field labels", async () => {
      const aboutSection = await AboutSectionFactory.create({
        type: "project",
        frameworks: ["ppc"],
        header: "About Header",
        title: "About Title",
        description: "About Description",
        contactSupportMessage: "Support Message",
        contactSupportSubject: "Support Subject"
      });
      await LinkFactory.section(aboutSection).create({ title: "Link Title" });

      const context = await service.authorizeAndGetPushContext("aboutSections", aboutSection.uuid);
      expect(context.entityType).toBe("aboutSections");
      expect(context.entityName).toBe("type=project, frameworks=ppc");
      expect(context.i18nLabels).toEqual(
        expect.arrayContaining([
          "About Header",
          "About Title",
          "About Description",
          "Support Message",
          "Support Subject",
          "Link Title"
        ])
      );
    });

    it("throws NotFoundException when the entity is missing", async () => {
      await expect(service.authorizeAndGetPushContext("forms", "missing-uuid")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getI18nLabelsForForm", () => {
    it("should return labels for a form with sections and questions", async () => {
      const form = await FormFactory.create();
      const section1 = await FormSectionFactory.form(form).create();
      const section2 = await FormSectionFactory.form(form).create();
      await FormQuestionFactory.section(section1).create();
      await FormQuestionFactory.section(section2).create();
      const labels = await service.getI18nLabelsForForm(form);
      expect(labels).toBeDefined();
    });
  });

  describe("pullTranslations", () => {
    it("authorizes then throws NotImplementedException for unsupported entities", async () => {
      const form = await FormFactory.create({ title: "Pull Form" });
      jest.spyOn(policyService, "authorize").mockResolvedValue();

      await expect(service.pullTranslations("forms", form.uuid)).rejects.toThrow(NotImplementedException);
      expect(policyService.authorize).toHaveBeenCalled();
    });

    it("authorizes then throws NotImplementedException for about sections", async () => {
      const aboutSection = await AboutSectionFactory.create();
      jest.spyOn(policyService, "authorize").mockResolvedValue();

      await expect(service.pullTranslations("aboutSections", aboutSection.uuid)).rejects.toThrow(
        NotImplementedException
      );
      expect(policyService.authorize).toHaveBeenCalled();
    });

    it("creates missing Transifex resources for localization keys", async () => {
      const localizationKey = await LocalizationKeyFactory.create({ value: "Missing Resource" });
      transifexApiService.getResourceString.mockResolvedValue({ data: [] });

      const processed = await service.pullTranslations("localizationKeys", null);

      expect(processed).toEqual([localizationKey.valueId]);
      expect(transifexApiService.getResourceString).toHaveBeenCalledWith("hash:Missing Resource");
      expect(transifexApiService.createResourceString).toHaveBeenCalledWith(
        "hash:Missing Resource",
        "Missing Resource"
      );
      expect(transifexApiService.getTranslation).not.toHaveBeenCalled();
    });

    it("pulls and stores translations when the Transifex resource already exists", async () => {
      const localizationKey = await LocalizationKeyFactory.create({ value: "Existing Resource" });
      const existingTranslation = await I18nTranslationFactory.create({
        i18nItemId: localizationKey.valueId,
        language: "es-MX",
        shortValue: "Old"
      });
      transifexApiService.getResourceString.mockResolvedValue({ data: [{ id: "existing" }] });
      transifexApiService.getTranslation.mockImplementation(async (_hash, locale) => {
        if (locale === "es_MX") {
          return { data: { attributes: { strings: { other: "Recurso existente" } } } };
        }
        if (locale === "fr_FR") {
          return { data: { attributes: { strings: { other: "Ressource existante" } } } };
        }
        return null;
      });

      const processed = await service.pullTranslations("localizationKeys", null);

      expect(processed).toEqual([localizationKey.valueId]);
      expect(transifexApiService.createResourceString).not.toHaveBeenCalled();

      await existingTranslation.reload();
      expect(existingTranslation.shortValue).toBe("Recurso existente");

      const french = await I18nTranslation.findOne({
        where: { i18nItemId: localizationKey.valueId, language: "fr-FR" }
      });
      expect(french?.shortValue).toBe("Ressource existante");

      const i18nItem = await I18nItem.findByPk(localizationKey.valueId);
      expect(i18nItem?.status).toBe("translated");
    });
  });
});
