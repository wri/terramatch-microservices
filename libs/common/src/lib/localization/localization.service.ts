import { Injectable, NotFoundException } from "@nestjs/common";
import { I18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { ConfigService } from "@nestjs/config";
import { normalizeLocale, tx } from "@transifex/native";
import { Dictionary } from "lodash";

@Injectable()
export class LocalizationService {
  constructor(configService: ConfigService) {
    tx.init({
      token: configService.get("TRANSIFEX_TOKEN")
    });
  }

  async translateKeys(keyMap: Dictionary<string>, locale: string, replacements: Dictionary<string> = {}) {
    const keyStrings = Object.values(keyMap);
    const keys = await this.getLocalizationKeys(keyStrings);
    const i18nItemIds = keys.map(({ valueId }) => valueId).filter(id => id != null);
    const translations =
      i18nItemIds.length === 0
        ? []
        : await I18nTranslation.findAll({
            where: { i18nItemId: { [Op.in]: i18nItemIds }, language: locale }
          });

    return Object.entries(keyMap).reduce((result, [prop, key]) => {
      const { value, valueId } = keys.find(record => record.key === key) ?? {};
      if (value == null) throw new NotFoundException(`Localization key not found [${key}]`);

      const translation = translations.find(({ i18nItemId }) => i18nItemId === valueId);
      const translated = Object.entries(replacements).reduce(
        (translated, [replacementKey, replacementValue]) => translated.replaceAll(replacementKey, replacementValue),
        translation?.longValue ?? translation?.shortValue ?? value
      );

      return { ...result, [prop]: translated };
    }, {} as Dictionary<string>);
  }

  async getLocalizationKeys(keys: string[]): Promise<LocalizationKey[]> {
    return (await LocalizationKey.findAll({ where: { key: { [Op.in]: keys } } })) ?? [];
  }

  /**
   * Translate text to the target locale.
   * @param text The text to translate.
   * @param locale The target locale (e.g., 'es', 'fr').
   * @returns The translated text.
   */
  async localizeText(text: string, locale: string): Promise<string> {
    // Set the locale for the SDK
    const txLocale = normalizeLocale(locale);
    await tx.setCurrentLocale(txLocale);

    // Translate the text
    return tx.t(text);
  }
}
