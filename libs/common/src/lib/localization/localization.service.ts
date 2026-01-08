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
import { Attributes, Model, Op, WhereOptions } from "sequelize";
import { ConfigService } from "@nestjs/config";
import { createNativeInstance, ITranslateParams, normalizeLocale, t, tx } from "@transifex/native";
import { Dictionary, groupBy } from "lodash";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { DRAFT, MODIFIED } from "@terramatch-microservices/database/constants/status";
import { TMLogger } from "../util/tm-logger";
import { DocumentBuilder } from "../util";
import { FormTranslationDto } from "../dto/form-translation.dto";

// A mapping of I18nItem ID to a translated value, or null if no translation is available.
export type Translations = Record<number, string | null>;
export type TransifexSource = Record<
  string,
  {
    meta: {
      character_limit: number;
      context: string;
      developer_comment: string;
      occurrences: string[];
      tags: string[];
    };
    string: string;
  }
>;
export type TransifexPullTranslationsConfig = {
  filterTags?: string;
  refresh?: boolean;
};
export type TransifexPullTranslationsMap = {
  locale: string;
  translation: string;
  i18nItemId: number | null;
  i18nTranslationId: number | null;
};

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
    value = value?.trim();
    if (value == null || value === "") return currentId ?? null;

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

    const language = locale === "en-US" ? [locale, "en"] : locale;
    return (
      await I18nTranslation.findAll({
        where: { language, i18nItemId: ids },
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

  translateFields<M extends Model, K extends (keyof Attributes<M>)[]>(translations: Translations, model: M, fields: K) {
    return fields.reduce(
      (translated, field) => ({
        ...translated,
        [field]: translations[model[`${String(field)}Id` as Attributes<M>[number]] ?? -1] ?? model[field]
      }),
      {} as Record<(typeof fields)[number], string>
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

  async pullTranslations(config?: TransifexPullTranslationsConfig) {
    const tx = this.createNativeInstance();
    const locales = ["en_US", "fr_FR", "es_MX", "pt_BR"];
    const txMapHashToTranslations: Record<string, TransifexPullTranslationsMap[]> = {};
    for (const locale of locales) {
      const dbLocale = locale.split("_").join("-");
      await tx.fetchTranslations(locale, config);
      const txTranslations = await tx.cache.getTranslations(locale);
      const keys = Object.keys(txTranslations);
      for (const key of keys) {
        if (txMapHashToTranslations[key] == null) {
          txMapHashToTranslations[key] = [];
        }
        txMapHashToTranslations[key].push({
          locale: dbLocale,
          translation: txTranslations[key],
          i18nItemId: null,
          i18nTranslationId: null
        });
      }
    }
    const i18nItems = await I18nItem.findAll({ where: { hash: { [Op.in]: Object.keys(txMapHashToTranslations) } } });
    const i18nTranslations = await I18nTranslation.findAll({
      where: { i18nItemId: { [Op.in]: i18nItems.map(i18nItem => i18nItem.id) } }
    });
    const i18nTranslationsMap = groupBy(i18nTranslations, "i18nItemId");
    const savePromises: Promise<I18nItem | I18nTranslation>[] = [];
    for (const i18nItem of i18nItems) {
      const { hash } = i18nItem;
      txMapHashToTranslations[hash as string].forEach(async txTranslation => {
        const i18nItemId = i18nItem.id;
        const dbI18nTranslations = i18nTranslationsMap[i18nItemId];
        const i18nTranslation = dbI18nTranslations?.find(
          dbI18nTranslation => dbI18nTranslation.language === txTranslation.locale
        );
        const isShort = txTranslation.translation.length < 256;
        if (i18nTranslation !== undefined) {
          i18nTranslation.shortValue = isShort ? txTranslation.translation : null;
          i18nTranslation.longValue = isShort ? null : txTranslation.translation;
          i18nTranslation.language = txTranslation.locale;
          savePromises.push(i18nTranslation.save());
        } else {
          savePromises.push(
            I18nTranslation.create({
              i18nItemId,
              language: txTranslation.locale,
              shortValue: isShort ? txTranslation.translation : null,
              longValue: isShort ? null : txTranslation.translation
            } as I18nTranslation)
          );
        }
      });
      i18nItem.status = "translated";
      savePromises.push(
        i18nItem.save({
          hooks: false
        })
      );
    }
    await Promise.all(savePromises);
    this.logger.log(`Finished processing ${i18nItems.length} keys`);
    return i18nItems.map(({ id }) => id);
  }

  public async pushNewTranslations() {
    const tx = this.createNativeInstance();
    const condition: WhereOptions<I18nItem> = { status: { [Op.in]: [DRAFT, MODIFIED] } };
    const items = await this.getTranslationsByCondition(condition);
    const source = this.createSource(items, ["custom-form"]);
    await tx.pushSource(source);
    this.logger.log(`Finished pushing ${items.length} items`);
  }

  public async pushTranslationByForm(form: Form, i18nIds: number[]) {
    const tx = this.createNativeInstance();
    const items = await this.getTranslationsByCondition({ id: { [Op.in]: i18nIds } });
    const source = this.createSource(items, ["custom-form", form.uuid]);
    await tx.pushSource(source);
    this.logger.log(`Finished pushing ${items.length} items`);
    return i18nIds;
  }

  private createNativeInstance() {
    return createNativeInstance({
      token: this.configService.get("TRANSIFEX_TOKEN"),
      secret: this.configService.get("TRANSIFEX_SECRET")
    });
  }

  private async getTranslationsByCondition(where: WhereOptions<I18nItem>): Promise<I18nItem[]> {
    return await I18nItem.findAll({ where, attributes: ["hash", "shortValue", "longValue"] });
  }

  private createSource(items: I18nItem[], tags: string[]) {
    return items.reduce((source, item) => {
      return {
        ...source,
        [item.hash ?? ""]: {
          meta: {
            character_limit: 1000,
            context: "",
            developer_comment: "",
            occurrences: [],
            tags
          },
          string: item.shortValue ?? item.longValue ?? ""
        }
      };
    }, {} as TransifexSource);
  }

  async cleanOldI18nItems() {
    const i18nEntitiesColumns = [
      { entity: FormOptionListOption, attributes: ["labelId"] },
      { entity: FormQuestionOption, attributes: ["labelId"] },
      { entity: FormQuestion, attributes: ["labelId", "descriptionId", "placeholderId"] },
      { entity: FormSection, attributes: ["titleId", "subtitleId", "descriptionId"] },
      { entity: FormTableHeader, attributes: ["labelId"] },
      { entity: Form, attributes: ["titleId", "subtitleId", "descriptionId", "submissionMessageId"] },
      { entity: FundingProgramme, attributes: ["locationId"] },
      { entity: LocalizationKey, attributes: ["valueId"] }
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
  }

  addTranslationDto(document: DocumentBuilder, uuid: string, i18nItemIds: number[]) {
    document.addData(uuid, new FormTranslationDto(i18nItemIds.length));
    return document;
  }
}
