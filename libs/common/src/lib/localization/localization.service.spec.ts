import { Test, TestingModule } from "@nestjs/testing";
import { LocalizationService } from "./localization.service";
import { I18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { normalizeLocale, t, tx } from "@transifex/native";
import { createMock } from "@golevelup/ts-jest";
import { I18nTranslationFactory } from "@terramatch-microservices/database/factories/i18n-translation.factory";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";
import { Dictionary } from "lodash";
import { NotFoundException } from "@nestjs/common";

jest.mock("@transifex/native", () => ({
  tx: {
    init: jest.fn(),
    setCurrentLocale: jest.fn()
  },
  t: jest.fn(),
  normalizeLocale: jest.fn()
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

      const result = await service.localizeText(text, "es_ES");
      expect(normalizeLocale).toHaveBeenCalledWith("es_ES");
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
});
