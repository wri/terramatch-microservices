import { Injectable, NotFoundException } from "@nestjs/common";
import { I18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { ConfigService } from "@nestjs/config";
import { ITranslateParams, normalizeLocale, tx, t } from "@transifex/native";
import { Dictionary } from "lodash";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

// A mapping of I18nItem ID to a translated value, or null if no translation is available.
type Translations = Record<number, string | null>;

@Injectable()
export class LocalizationService {
  constructor(configService: ConfigService) {
    tx.init({
      token: configService.get("TRANSIFEX_TOKEN")
    });
  }

  async translateKeys(keyMap: Dictionary<string>, locale: ValidLocale, replacements: Dictionary<string> = {}) {
    const keyStrings = Object.values(keyMap);
    const keys = await this.getLocalizationKeys(keyStrings);
    const i18nItemIds = keys.map(({ valueId }) => valueId).filter(id => id != null);
    const translations = await this.translateIds(i18nItemIds, locale);

    return Object.entries(keyMap).reduce((result, [prop, key]) => {
      const { value, valueId } = keys.find(record => record.key === key) ?? {};
      if (value == null) throw new NotFoundException(`Localization key not found [${key}]`);

      const translated = Object.entries(replacements).reduce(
        (translated, [replacementKey, replacementValue]) => translated.replaceAll(replacementKey, replacementValue),
        translations[valueId ?? -1] ?? value
      );

      return { ...result, [prop]: translated };
    }, {} as Dictionary<string>);
  }

  /**
   * Returns a mapping of the given I18nItem IDs to their translated values in the given locale
   */
  async translateIds(ids: number[], locale: ValidLocale) {
    if (ids.length === 0) return {} as Translations;

    return (
      await I18nTranslation.findAll({
        where: { language: locale, i18nItemId: ids },
        // Note: it is expected that a given translation has either a short value or a long value; never both.
        attributes: ["i18nItemId", "shortValue", "longValue"]
      })
    ).reduce(
      (translations, { i18nItemId, shortValue, longValue }) => ({
        ...translations,
        [i18nItemId]: shortValue ?? longValue
      }),
      {} as Translations
    );
  }

  async getLocalizationKeys(keys: string[]): Promise<LocalizationKey[]> {
    return await LocalizationKey.findAll({ where: { key: { [Op.in]: keys } } });
  }

  /**
   * Translate text to the target locale.
   * @param text The text to translate.
   * @param locale The target locale (e.g., 'es', 'fr').
   * @param params The optional translation substitution params
   * @returns The translated text.
   */
  async localizeText(text: string, locale: ValidLocale, params?: ITranslateParams) {
    // Set the locale for the SDK
    const txLocale = normalizeLocale(locale);
    await tx.setCurrentLocale(txLocale);

    // Translate the text
    return t(text, params);
  }
}
