/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import { LocalizationService } from "./localization.service";
import {
  Form,
  FormOptionListOption,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader,
  FundingProgramme,
  I18nItem,
  I18nTranslation,
  LocalizationKey
} from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { createNativeInstance, normalizeLocale, t, tx } from "@transifex/native";
import { createMock } from "@golevelup/ts-jest";
import { I18nTranslationFactory } from "@terramatch-microservices/database/factories/i18n-translation.factory";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";
import { Dictionary, trim } from "lodash";
import { NotFoundException } from "@nestjs/common";
import { FormFactory, FormQuestionFactory, I18nItemFactory } from "@terramatch-microservices/database/factories";
import { buildJsonApi } from "../util/json-api-builder";
import { FormTranslationDto } from "../dto/form-translation.dto";

jest.mock("@transifex/native", () => ({
  tx: {
    init: jest.fn(),
    setCurrentLocale: jest.fn(),
    pushSource: jest.fn()
  },
  t: jest.fn(),
  normalizeLocale: jest.fn(),
  createNativeInstance: jest.fn().mockImplementation(() => ({
    fetchTranslations: jest.fn(),
    cache: {
      getTranslations: jest.fn().mockImplementation(() => ({
        foo: "bar"
      }))
    },
    pushSource: jest.fn()
  }))
}));

describe("LocalizationService", () => {
  let service: LocalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalizationService, { provide: ConfigService, useValue: createMock<ConfigService>() }]
    }).compile();

    service = module.get<LocalizationService>(LocalizationService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("getLocalizationKeys", () => {
    it("should return an empty array when no localization keys are found", async () => {
      await expect(service.getLocalizationKeys(["foo", "abc"])).resolves.toStrictEqual([]);
    });

    it("should return one localization key when a matching key is found", async () => {
      const localization = [new LocalizationKey()];
      jest.spyOn(LocalizationKey, "findAll").mockImplementation(() => Promise.resolve(localization));
      const result = await service.getLocalizationKeys(["foo"]);
      expect(result.length).toBe(1);
    });

    it("should return an empty array when none of the keys are found", async () => {
      await LocalizationKey.truncate();
      expect(await service.getLocalizationKeys(["foo", "bar"])).toStrictEqual([]);
    });
  });

  describe("localizeText", () => {
    it("should normalize the locale and return the translated text", async () => {
      const text = "Hello";
      const locale = "es_MX";
      const translatedText = "Hola";

      (normalizeLocale as jest.Mock).mockReturnValue(locale);
      (tx.setCurrentLocale as jest.Mock).mockResolvedValue(undefined);
      (t as jest.Mock).mockReturnValue(translatedText);

      const result = await service.localizeText(text, "es-MX");
      expect(normalizeLocale).toHaveBeenCalledWith("es-MX");
      expect(tx.setCurrentLocale).toHaveBeenCalledWith(locale);
      expect(t).toHaveBeenCalledWith(text, undefined);
      expect(result).toBe(translatedText);
    });
  });

  describe("translateKeys", () => {
    it("should translate", async () => {
      const enTranslations = await I18nTranslationFactory.createMany(5, { shortValue: null });
      const esTranslations = await Promise.all(
        enTranslations.map(({ i18nItemId }) =>
          I18nTranslationFactory.create({ i18nItemId, language: "es-MX", shortValue: null })
        )
      );
      const localizationKeys = await Promise.all(
        enTranslations.map(({ i18nItemId }) => LocalizationKeyFactory.create({ valueId: i18nItemId }))
      );

      const keyMap = localizationKeys.reduce(
        (keyMap, { key }) => ({ ...keyMap, [faker.lorem.slug()]: key as string }),
        {} as Dictionary<string>
      );

      const reduceTranslations = (translations: I18nTranslation[]) =>
        Object.entries(keyMap).reduce((i18nMap, [prop, key]) => {
          const itemId = localizationKeys.find(({ key: lKey }) => lKey === key)?.valueId;
          if (itemId == null) return i18nMap;

          const translation = translations.find(({ i18nItemId }) => i18nItemId === itemId);
          return {
            ...i18nMap,
            [prop]: translation?.longValue ?? translation?.shortValue ?? "missing-translation"
          };
        }, {} as Dictionary<string>);

      expect(await service.translateKeys(keyMap, "en-US")).toMatchObject(reduceTranslations(enTranslations));
      expect(await service.translateKeys(keyMap, "es-MX")).toMatchObject(reduceTranslations(esTranslations));
    });

    it("uses replacements", async () => {
      const esTranslation = await I18nTranslationFactory.create({
        language: "es-MX",
        longValue: null,
        shortValue: "Este edificio parece uno de {city}, y me encanta {city} y todos los ciudades de {country}."
      });
      const { key } = await LocalizationKeyFactory.create({ valueId: esTranslation.i18nItemId });
      expect(
        (
          await service.translateKeys({ body: key as string }, "es-MX", {
            ["{city}"]: "Barcelona",
            ["{country}"]: "España"
          })
        )["body"]
      ).toBe("Este edificio parece uno de Barcelona, y me encanta Barcelona y todos los ciudades de España.");
    });

    it("should throw if a localization key is missing", async () => {
      await LocalizationKey.truncate();
      await expect(service.translateKeys({ foo: "bar" }, "es-MX")).rejects.toThrow(NotFoundException);
    });

    it("should use the value from LocalizationKey if there is no translation", async () => {
      const { key, value } = await LocalizationKeyFactory.create();
      expect((await service.translateKeys({ foo: key as string }, "es-MX"))["foo"]).toEqual(value);
    });
  });

  describe("generateI18nId", () => {
    it("returns the current id when the value is null", async () => {
      const result = await service.generateI18nId(null, -2);
      expect(result).toBe(-2);
    });

    it("does not create a new item when the value matches the current item", async () => {
      const item = await I18nItemFactory.create();
      const result = await service.generateI18nId(item.shortValue, item.id);
      expect(result).toBe(item.id);
    });

    it("trims the value before checking against the current item", async () => {
      const item = await I18nItemFactory.create();
      const result = await service.generateI18nId(`  ${item.shortValue} `, item.id);
      expect(result).toBe(item.id);
    });

    it("creates a new i18n item", async () => {
      const shortValue = `  ${faker.lorem.slug()}`;
      const longValue = faker.lorem.paragraphs(10);

      const shortResult = await service.generateI18nId(shortValue);
      const longResult = await service.generateI18nId(longValue);

      const shortItem = await I18nItem.findOne({ where: { id: shortResult! } });
      const longItem = await I18nItem.findOne({ where: { id: longResult! } });

      expect(shortItem?.shortValue).toBe(trim(shortValue));
      expect(longItem?.longValue).toBe(longValue);
    });
  });

  describe("pullTranslations", () => {
    it("should pull translations when a i18nTranslation is not found", async () => {
      const i18nItem = await I18nItemFactory.create();
      (createNativeInstance as jest.Mock).mockImplementation(() => ({
        fetchTranslations: jest.fn().mockResolvedValue({}),
        cache: {
          getTranslations: jest.fn().mockImplementation(() => ({
            [i18nItem.hash ?? ""]: "bar"
          }))
        }
      }));
      await service.pullTranslations();
      const i18nItemAfter = await I18nItem.findOne({ where: { id: i18nItem.id } });
      expect(i18nItemAfter?.status).toBe("translated");
    });
    it("should pull translations when a i18nTranslation is found", async () => {
      const i18nItem = await I18nItemFactory.create();
      await I18nTranslationFactory.create({
        i18nItemId: i18nItem.id,
        language: "fr-FR",
        shortValue: "bar"
      });
      (createNativeInstance as jest.Mock).mockImplementation(() => ({
        fetchTranslations: jest.fn().mockResolvedValue({}),
        cache: {
          getTranslations: jest.fn().mockImplementation(() => ({
            [i18nItem.hash ?? ""]: "bar"
          }))
        }
      }));
      await service.pullTranslations();
      const i18nItemAfter = await I18nItem.findOne({ where: { id: i18nItem.id } });
      expect(i18nItemAfter?.status).toBe("translated");
    });
  });

  describe("pushTranslations", () => {
    it("should push translations", async () => {
      const pushSouceMock = jest.fn();
      (createNativeInstance as jest.Mock).mockImplementation(() => ({
        pushSource: pushSouceMock
      }));
      await service.pushNewTranslations();
      expect(pushSouceMock).toHaveBeenCalled();
    });
  });

  describe("pushTranslationByForm", () => {
    it("should push translations by form", async () => {
      const form = await FormFactory.create();
      const pushSouceMock = jest.fn();
      (createNativeInstance as jest.Mock).mockImplementation(() => ({
        pushSource: pushSouceMock
      }));
      await service.pushTranslationByForm(form, [1, 2, 3]);
      expect(pushSouceMock).toHaveBeenCalled();
    });
  });

  describe("cleanOldI18nItems", () => {
    it("should clean old I18nItems", async () => {
      // Cleaning up the database
      const entities = [
        I18nItem,
        Form,
        FormSection,
        FormQuestion,
        FormQuestionOption,
        FormTableHeader,
        FormOptionListOption,
        LocalizationKey,
        FundingProgramme
      ];
      for (const entity of entities) {
        // @ts-expect-error - entity is a model class
        await entity.truncate();
      }
      // First form question with a label
      const formQuestion = await FormQuestionFactory.create();
      const firstLabelI18nItem = await I18nItemFactory.create({ shortValue: formQuestion.label });
      formQuestion.labelId = firstLabelI18nItem.id;
      await formQuestion.save();
      const previousCount = await I18nItem.count();
      // Here we typically replaced the old id with the new id
      formQuestion.label = "testing";
      const seconLabelI18nItem = await I18nItemFactory.create({ shortValue: formQuestion.label });
      formQuestion.labelId = seconLabelI18nItem.id;
      await formQuestion.save();
      // cleaning up the old I18nItems
      await service.cleanOldI18nItems();
      const afterCount = await I18nItem.count();
      expect(afterCount).toBe(previousCount);
    });
  });

  describe("addTranslationDto", () => {
    it("should add translation DTOs to the document", () => {
      const document = buildJsonApi(FormTranslationDto);
      const i18nItemIds = [1, 2, 3];
      service.addTranslationDto(document, i18nItemIds);
      expect(document.data.length).toBe(i18nItemIds.length);
    });
  });
});
