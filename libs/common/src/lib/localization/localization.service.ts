import { Injectable, NotFoundException } from "@nestjs/common";
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
import { Op } from "sequelize";
import { ConfigService } from "@nestjs/config";
import { ITranslateParams, normalizeLocale, tx, t, createNativeInstance } from "@transifex/native";
import { Dictionary } from "lodash";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { DRAFT, MODIFIED } from "@terramatch-microservices/database/constants/status";
import { TMLogger } from "../util/tm-logger";

// A mapping of I18nItem ID to a translated value, or null if no translation is available.
export type Translations = Record<number, string | null>;

@Injectable()
export class LocalizationService {
  private readonly logger = new TMLogger(LocalizationService.name);

  constructor(private readonly configService: ConfigService) {
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

  async generateI18nId(value?: string | null, currentId?: number | null) {
    if (value == null) return currentId ?? null;

    value = value.trim();
    const current = currentId == null ? null : await I18nItem.findOne({ where: { id: currentId } });
    if (current != null && (current.shortValue === value || current.longValue === value)) {
      return current.id;
    }

    const short = value.length < 256;
    const item = new I18nItem();
    item.type = short ? "short" : "long";
    item.status = "draft";
    item.shortValue = short ? value : null;
    item.longValue = short ? null : value;
    await item.save();

    return item.id;
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

  async pullTranslations() {
    const tx = createNativeInstance({
      token: this.configService.get("TRANSIFEX_TOKEN"),
      secret: this.configService.get("TRANSIFEX_SECRET")
    });
    const locales = ["en_US", "fr_FR", "es_MX", "pt_BR"];
    for (const locale of locales) {
      const dbLocale = locale.split("_").join("-");
      await tx.fetchTranslations(locale);
      const translations = await tx.cache.getTranslations(locale);
      const keys = Object.keys(translations);
      for (const key of keys) {
        const translation = translations[key];
        const i18nItems = await I18nItem.findAll({ where: { hash: key } });
        for (const i18nItem of i18nItems) {
          const isShort = i18nItem.shortValue != null;
          let i18nTranslation = await I18nTranslation.findOne({
            where: {
              i18nItemId: i18nItem.id,
              language: dbLocale
            }
          });
          if (i18nTranslation == null) {
            i18nTranslation = await I18nTranslation.create({
              i18nItemId: i18nItem.id,
              language: dbLocale,
              shortValue: isShort ? translation : null,
              longValue: isShort ? null : translation
            } as I18nTranslation);
          } else {
            i18nTranslation.shortValue = isShort ? translation : null;
            i18nTranslation.longValue = isShort ? null : translation;
            i18nTranslation.language = dbLocale;
            await i18nTranslation.save();
          }
          i18nItem.status = "translated";
          await i18nItem.save({
            hooks: false
          });
        }
      }
      this.logger.log(`Finished processing ${keys.length} keys for ${normalizeLocale(locale)}`);
    }
  }

  async pushTranslations() {
    const tx = createNativeInstance({
      token: this.configService.get("TRANSIFEX_TOKEN"),
      secret: this.configService.get("TRANSIFEX_SECRET")
    });

    const items = await I18nItem.findAll({
      where: {
        status: {
          [Op.in]: [DRAFT, MODIFIED]
        }
      }
    });
    const source = items.reduce((source, item) => {
      return {
        ...source,
        [item.hash ?? ""]: {
          meta: {
            character_limit: 1000,
            context: "",
            developer_comment: "",
            occurrences: [],
            tags: ["custom-form"]
          },
          string: item.shortValue ?? item.longValue ?? ""
        }
      };
    }, {} as Record<string, { meta: { character_limit: number; context: string; developer_comment: string; occurrences: string[]; tags: string[] }; string: string }>);
    await tx.pushSource(source);
  }

  cleanOldI18nItems = async () => {
    const i18nEntitiesColumns = [
      { entity: Form, attributes: ["titleId", "subtitleId", "descriptionId", "submissionMessageId"] },
      { entity: FormOptionListOption, attributes: ["labelId"] },
      { entity: FormQuestion, attributes: ["labelId", "descriptionId"] },
      { entity: FormQuestionOption, attributes: ["labelId"] },
      { entity: FormSection, attributes: ["titleId", "subtitleId", "descriptionId"] },
      { entity: FormTableHeader, attributes: ["labelId"] },
      { entity: LocalizationKey, attributes: ["valueId"] },
      { entity: FundingProgramme, attributes: ["locationId"] }
    ];
    const i18nIds: number[] = [];
    for (const { entity, attributes } of i18nEntitiesColumns) {
      // @ts-expect-error - entity is a model class
      const entities = await entity.findAll({ attributes });
      for (const entity of entities) {
        Object.entries(entity.dataValues).forEach(([, value]) => {
          if (value != null) {
            i18nIds.push(value);
          }
        });
      }
    }
    this.logger.log(`i18nIds.length: ${i18nIds.length}`);
    const i18nItems = await I18nItem.count();
    this.logger.log(`i18nItems.length: ${i18nItems}`);
    const translationsDeleted = await I18nTranslation.destroy({ where: { i18nItemId: { [Op.notIn]: i18nIds } } });
    const itemsDeleted = await I18nItem.destroy({ where: { id: { [Op.notIn]: i18nIds } } });
    this.logger.log(`Deleted ${itemsDeleted} I18nItems and ${translationsDeleted} I18nTranslations`);
    this.logger.log(`Finished cleaning old I18nItems`);
  };
}
