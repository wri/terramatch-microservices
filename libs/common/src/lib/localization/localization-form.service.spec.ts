import { Test } from "@nestjs/testing";
import { LocalizationFormService } from "./localization-form.service";
import {
  FormFactory,
  FormQuestionFactory,
  FormSectionFactory,
  I18nItemFactory
} from "@terramatch-microservices/database/factories";

describe("LocalizationFormService", () => {
  let service: LocalizationFormService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [LocalizationFormService]
    }).compile();

    service = module.get<LocalizationFormService>(LocalizationFormService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("getI18nIdsForForm", () => {
    it("should return the I18n IDs for a form", async () => {
      const i18nItem = await I18nItemFactory.create();
      const form = await FormFactory.create({ titleId: i18nItem.id });
      const formSection1 = await FormSectionFactory.create({ formId: form.uuid });
      const formSection2 = await FormSectionFactory.create({ formId: form.uuid });
      await FormQuestionFactory.create({ formSectionId: formSection1.id });
      await FormQuestionFactory.create({ formSectionId: formSection2.id });
      const i18nIds = await service.getI18nIdsForForm(form);
      expect(i18nIds).toBeDefined();
    });
  });
});
