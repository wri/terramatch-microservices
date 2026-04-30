import { OptionLabelModel, OptionLabelsController } from "./option-labels.controller";
import { Test } from "@nestjs/testing";
import { FormOptionList, FormOptionListOption, FormQuestion } from "@terramatch-microservices/database/entities";
import {
  FormOptionListFactory,
  FormOptionListOptionFactory,
  FormQuestionOptionFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { I18nTranslationFactory } from "@terramatch-microservices/database/factories/i18n-translation.factory";
import { mockRequestContext, serialize } from "@terramatch-microservices/common/util/testing";
import { NotFoundException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { createMock } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";

describe("OptionsLabelsController", () => {
  let controller: OptionLabelsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OptionLabelsController],
      providers: [LocalizationService, { provide: ConfigService, useValue: createMock<ConfigService>() }]
    }).compile();

    controller = module.get(OptionLabelsController);

    await FormOptionListOption.truncate();
    await FormQuestion.truncate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("optionLabelsIndex", () => {
    it("should throw an error if ids is empty", async () => {
      mockRequestContext({ userId: 123 });
      await expect(controller.optionLabelsIndex([])).rejects.toThrow("Set of ids is required");
    });

    it("should throw if no locale is found", async () => {
      mockRequestContext({ userId: -1, locale: null });
      await expect(controller.optionLabelsIndex(["1"])).rejects.toThrow("Locale is required");
    });

    it("should return list option labels", async () => {
      const options = [await FormOptionListOptionFactory.create()];
      options.push(await FormOptionListOptionFactory.create({ imageUrl: faker.internet.url() }));
      await FormOptionListOptionFactory.create();

      mockRequestContext({ userId: 123, locale: "en-US" });
      const document = serialize(await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[]));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: { slug, label, imageUrl: imageUrl ?? null, altValue: null }
        });
      }
    });

    it("should supplement with form question labels", async () => {
      const options = [(await FormOptionListOptionFactory.create()) as OptionLabelModel];
      options.push((await FormOptionListOptionFactory.create({ imageUrl: faker.internet.url() })) as OptionLabelModel);
      await FormOptionListOptionFactory.create();
      options.push((await FormQuestionOptionFactory.forQuestion().create()) as OptionLabelModel);

      mockRequestContext({ userId: 123, locale: "en-US" });
      const document = serialize(await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[]));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: { slug, label, imageUrl: imageUrl ?? null, altValue: null }
        });
      }
    });

    it("should throw an error if no ids are found", async () => {
      mockRequestContext({ userId: 123, locale: "en-US" });
      await expect(controller.optionLabelsIndex(["1", "2"])).rejects.toThrow("No records matching the given ids exist");
    });

    it("should translate", async () => {
      const translation1 = await I18nTranslationFactory.create({ language: "es-MX", shortValue: null });
      const translation2 = await I18nTranslationFactory.create({ language: "es-MX" });
      const listOption = await FormOptionListOptionFactory.create({ labelId: translation1.i18nItemId });
      const questionOption = await FormQuestionOptionFactory.forQuestion().create({ labelId: translation2.i18nItemId });
      const options = [listOption, questionOption];
      const translations = [translation1, translation2];

      mockRequestContext({ userId: 123, locale: "es-MX" });
      const document = serialize(await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[]));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, labelId, imageUrl } of options) {
        const translation = translations.find(({ i18nItemId }) => i18nItemId === labelId);
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: {
            slug,
            imageUrl: imageUrl ?? null,
            label: translation?.shortValue ?? translation?.longValue,
            altValue: null
          }
        });
      }
    });
  });

  describe("findList", () => {
    beforeEach(async () => {
      await FormOptionListOption.truncate();
      await FormOptionList.truncate();
    });

    it("should throw an error if listKey does not exist", async () => {
      mockRequestContext({ userId: 123 });
      await expect(controller.findList("fake-list-key")).rejects.toThrow(NotFoundException);
    });

    it("should throw an error if the listKey has no associated options", async () => {
      const { key } = await FormOptionListFactory.create();
      mockRequestContext({ userId: 123 });
      await expect(controller.findList(key)).rejects.toThrow(NotFoundException);
    });

    it("should throw if no locale is found", async () => {
      mockRequestContext({ userId: -1, locale: null });
      await expect(controller.findList("fake-list-key")).rejects.toThrow("Locale is required");
    });

    it("should return the options associated with the listKey", async () => {
      const { key, id } = await FormOptionListFactory.create();
      const options = await FormOptionListOptionFactory.createMany(5, { formOptionListId: id });
      mockRequestContext({ userId: 123 });
      const document = serialize(await controller.findList(key));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: { slug, label, imageUrl: imageUrl ?? null, altValue: null }
        });
      }
    });
  });
});
