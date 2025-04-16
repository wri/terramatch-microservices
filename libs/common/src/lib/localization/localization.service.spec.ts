import { Test, TestingModule } from "@nestjs/testing";
import { LocalizationService } from "./localization.service";
import { i18nItem, i18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { ConfigService } from "@nestjs/config";
import { tx, t } from "@transifex/native";
import { createMock } from "@golevelup/ts-jest";

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

  it("should return an empty array when no localization keys are found", async () => {
    await expect(service.getLocalizationKeys(["foo", "abc"])).resolves.toStrictEqual([]);
  });

  it("should return one localization key when a matching key is found", async () => {
    const localization = [new LocalizationKey()];
    jest.spyOn(LocalizationKey, "findAll").mockImplementation(() => Promise.resolve(localization));
    const result = await service.getLocalizationKeys(["foo"]);
    expect(result.length).toBe(1);
  });

  it("should return the translated text when a matching i18n item and translation record are found", async () => {
    const i18Record = new i18nTranslation();
    i18Record.shortValue = "contenido traducido";
    const i18Item = new i18nItem();
    jest.spyOn(i18nItem, "findOne").mockImplementation(() => Promise.resolve(i18Item));
    jest.spyOn(i18nTranslation, "findOne").mockImplementation(() => Promise.resolve(i18Record));
    const result = await service.translate("content translate", "es-MX");
    expect(result).toBe(i18Record.shortValue);
  });

  it("should return the original text when no matching i18n item is found", async () => {
    jest.spyOn(i18nItem, "findOne").mockImplementation(() => Promise.resolve(null));
    const result = await service.translate("content translate", "es-MX");
    expect(result).toBe("content translate");
  });

  it("should return the original text when no translation record is found for the given locale", async () => {
    const i18Item = new i18nItem();
    jest.spyOn(i18nItem, "findOne").mockImplementation(() => Promise.resolve(i18Item));
    jest.spyOn(i18nTranslation, "findOne").mockImplementation(() => Promise.resolve(null));
    const result = await service.translate("content translate", "es-MX");
    expect(result).toBe("content translate");
  });

  it("should translate text correctly", async () => {
    const text = "Hello";
    const locale = "es_MX";
    const translatedText = "Hola";

    (tx.setCurrentLocale as jest.Mock).mockResolvedValue(undefined);
    (t as jest.Mock).mockReturnValue(translatedText);

    const result = await service.localizeText(text, locale);
    expect(t).toHaveBeenCalledWith(text, undefined);
    expect(result).toBe(translatedText);
  });
});
