import { OptionLabelModel, OptionLabelsController } from "./option-labels.controller";
import { Test } from "@nestjs/testing";
import { FormOptionList, FormOptionListOption, FormQuestion, User } from "@terramatch-microservices/database/entities";
import {
  FormOptionListFactory,
  FormOptionListOptionFactory,
  FormQuestionOptionFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { I18nTranslationFactory } from "@terramatch-microservices/database/factories/i18n-translation.factory";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { NotFoundException } from "@nestjs/common";

const mockLocale = (locale: ValidLocale) => {
  jest.spyOn(User, "findOne").mockResolvedValue({ locale } as User);
};

describe("OptionsLabelsController", () => {
  let controller: OptionLabelsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OptionLabelsController]
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
      await expect(controller.optionLabelsIndex([], { authenticatedUserId: 123 })).rejects.toThrow(
        "Set of ids is required"
      );
    });

    it("should throw if no locale is found", async () => {
      await expect(controller.optionLabelsIndex(["1"], { authenticatedUserId: -1 })).rejects.toThrow(
        "Locale is required"
      );
    });

    it("should return list option labels", async () => {
      const options = [await FormOptionListOptionFactory.create()];
      options.push(await FormOptionListOptionFactory.create({ imageUrl: faker.internet.url() }));
      await FormOptionListOptionFactory.create();

      mockLocale("en-US");
      const document = serialize(
        await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[], {
          authenticatedUserId: 123
        })
      );
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
      options.push((await FormQuestionOptionFactory.create()) as OptionLabelModel);

      mockLocale("en-US");
      const document = serialize(
        await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[], {
          authenticatedUserId: 123
        })
      );
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
      mockLocale("en-US");
      await expect(controller.optionLabelsIndex(["1", "2"], { authenticatedUserId: 123 })).rejects.toThrow(
        "No records matching the given ids exist"
      );
    });

    it("should translate", async () => {
      const translation1 = await I18nTranslationFactory.create({ language: "es-MX", shortValue: null });
      const translation2 = await I18nTranslationFactory.create({ language: "es-MX" });
      const listOption = await FormOptionListOptionFactory.create({ labelId: translation1.i18nItemId });
      const questionOption = await FormQuestionOptionFactory.create({ labelId: translation2.i18nItemId });
      const options = [listOption, questionOption];
      const translations = [translation1, translation2];

      mockLocale("es-MX");
      const document = serialize(
        await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[], {
          authenticatedUserId: 123
        })
      );
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
      await expect(controller.findList("fake-list-key", { authenticatedUserId: 123 })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw an error if the listKey has no associated options", async () => {
      const { key } = await FormOptionListFactory.create();
      await expect(controller.findList(key, { authenticatedUserId: 123 })).rejects.toThrow(NotFoundException);
    });

    it("should throw if no locale is found", async () => {
      await expect(controller.findList("fake-list-key", { authenticatedUserId: -1 })).rejects.toThrow(
        "Locale is required"
      );
    });

    it("should return the options associated with the listKey", async () => {
      const { key, id } = await FormOptionListFactory.create();
      const options = await FormOptionListOptionFactory.createMany(5, { formOptionListId: id });
      const document = serialize(await controller.findList(key, { authenticatedUserId: 123 }));
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
