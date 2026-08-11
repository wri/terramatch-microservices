import { BadRequestException, Injectable, NotFoundException, NotImplementedException } from "@nestjs/common";
import {
  AboutSection,
  Form,
  FormOptionList,
  FormOptionListOption,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader,
  FundingProgramme,
  I18nItem,
  I18nTranslation,
  Link,
  LocalizationKey
} from "@terramatch-microservices/database/entities";
import { getTrackingEntryConfigLabels } from "@terramatch-microservices/common/localization/tracking-entry-config-i18n";
import { ModelCtor } from "sequelize-typescript/dist/model/model/model";
import { Model } from "sequelize-typescript";
import { CreationAttributes, Op } from "sequelize";
import { groupBy, intersection, isEmpty, uniq } from "lodash";
import { PolicyService } from "@terramatch-microservices/common";
import { TransifexApiService } from "@terramatch-microservices/transifex-api";
import { generateHashedKey } from "@transifex/native";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

export const TRANSLATABLE_ENTITIES = ["forms", "fundingProgrammes", "localizationKeys", "aboutSections"] as const;
export type TranslatableEntity = (typeof TRANSLATABLE_ENTITIES)[number];

type TranslationModelType =
  | typeof Form
  | typeof FormSection
  | typeof FormQuestion
  | typeof FormQuestionOption
  | typeof FormTableHeader
  | typeof FormOptionList
  | typeof FormOptionListOption
  | typeof FundingProgramme
  | typeof LocalizationKey
  | typeof AboutSection
  | typeof Link;

type TranslationParamsType = string | number;

type TransifexResourceStringResponse = { data?: unknown[] };
type TransifexTranslationResponse = {
  data?: { attributes?: { strings?: { other?: string | null } | null } };
};

const EXTRA_FIELDS: string[] = ["id", "optionsList", "additionalProps"];
const TRANSIFEX_LOCALES = [
  { txLocale: "fr_FR", dbLocale: "fr-FR" },
  { txLocale: "es_MX", dbLocale: "es-MX" },
  { txLocale: "pt_BR", dbLocale: "pt-BR" }
] as const;

export type TranslationPushContext = {
  uuid: string;
  i18nLabels: string[];
  entityType: TranslatableEntity;
  entityName: string;
};

@Injectable()
export class EntityTranslationsService {
  private readonly logger = new TMLogger(EntityTranslationsService.name);

  constructor(
    private readonly policyService: PolicyService,
    private readonly transifexApiService: TransifexApiService
  ) {}

  async authorizeAndGetPushContext(entity: TranslatableEntity, uuid?: string | null): Promise<TranslationPushContext> {
    switch (entity) {
      case "forms": {
        const form = (await this.findAndAuthorize(entity, uuid)) as Form;
        return {
          uuid: form.uuid,
          i18nLabels: await this.getI18nLabelsForForm(form),
          entityType: entity,
          entityName: form.title
        };
      }
      case "fundingProgrammes": {
        const fundingProgramme = (await this.findAndAuthorize(entity, uuid)) as FundingProgramme;
        return {
          uuid: fundingProgramme.uuid,
          i18nLabels: this.getI18nLabelsFromEntity(
            fundingProgramme,
            this.getTranslationLabelEntityFields(FundingProgramme)
          ),
          entityType: entity,
          entityName: fundingProgramme.name
        };
      }
      case "localizationKeys": {
        await this.policyService.authorize("update", LocalizationKey);
        const labelFields = this.getTranslationLabelEntityFields(LocalizationKey);
        const localizationKeys = await LocalizationKey.findAll({
          attributes: intersection(Object.keys(LocalizationKey.getAttributes()), [...labelFields, "id", "key"])
        });
        return {
          uuid: entity,
          i18nLabels: localizationKeys.flatMap(key => this.getI18nLabelsFromEntity(key, labelFields)),
          entityType: entity,
          entityName: entity
        };
      }
      case "aboutSections": {
        const aboutSection = (await this.findAndAuthorize(entity, uuid)) as AboutSection;
        return {
          uuid: aboutSection.uuid,
          i18nLabels: await this.getI18nLabelsForAboutSection(aboutSection),
          entityType: entity,
          entityName: `type=${aboutSection.type}, frameworks=${
            isEmpty(aboutSection.frameworks) ? "default" : aboutSection.frameworks?.join(", ")
          }`
        };
      }
    }
  }

  async pullTranslations(entity: TranslatableEntity, uuid: string | null | undefined): Promise<number[]> {
    await this.findAndAuthorize(entity, uuid);
    if (entity !== "localizationKeys") {
      throw new NotImplementedException("Entity translation pull is not implemented yet");
    }
    return await this.pullLocalizationKeyTranslations();
  }

  private async pullLocalizationKeyTranslations(): Promise<number[]> {
    const localizationKeys = (
      await LocalizationKey.findAll({
        attributes: ["id", "key", "value", "valueId"]
      })
    ).filter(key => key.valueId != null && key.value != null && key.value.trim() !== "");

    const existingTranslations = await I18nTranslation.findAll({
      where: { i18nItemId: { [Op.in]: localizationKeys.map(({ valueId }) => valueId) } }
    });
    const translationsByItemId = groupBy(existingTranslations, "i18nItemId");

    const translationCreations: Pick<I18nTranslation, "i18nItemId" | "language" | "shortValue" | "longValue">[] = [];
    const translationUpdates: Pick<I18nTranslation, "id" | "i18nItemId" | "language" | "shortValue" | "longValue">[] =
      [];
    const translatedItemIds = new Set<number>();
    const processedItemIds: number[] = [];

    for (const localizationKey of localizationKeys) {
      const value = localizationKey.value?.trim();
      const i18nItemId = localizationKey.valueId;
      if (value == null || value === "" || i18nItemId == null) continue;

      const hash = generateHashedKey(value);
      if (hash === "") continue;

      const existing = (await this.transifexApiService.getResourceString(hash)) as TransifexResourceStringResponse;
      if (existing.data == null || existing.data.length === 0) {
        await this.transifexApiService.createResourceString(hash, value);
        processedItemIds.push(i18nItemId);
        continue;
      }

      for (const { txLocale, dbLocale } of TRANSIFEX_LOCALES) {
        const translationResponse = (await this.transifexApiService.getTranslation(
          hash,
          txLocale
        )) as TransifexTranslationResponse | null;
        const translationText = translationResponse?.data?.attributes?.strings?.other?.trim();
        if (translationText == null || translationText === "") continue;

        const isShort = translationText.length < 256;
        const translationValues = {
          language: dbLocale,
          shortValue: isShort ? translationText : null,
          longValue: isShort ? null : translationText
        };
        const existingTranslation = translationsByItemId[i18nItemId]?.find(
          translation => translation.language === dbLocale
        );
        if (existingTranslation != null) {
          translationUpdates.push({
            id: existingTranslation.id,
            i18nItemId,
            ...translationValues
          });
        } else {
          translationCreations.push({
            i18nItemId,
            ...translationValues
          });
        }
        translatedItemIds.add(i18nItemId);
      }

      processedItemIds.push(i18nItemId);
    }

    if (translationCreations.length > 0) {
      await I18nTranslation.bulkCreate(translationCreations as CreationAttributes<I18nTranslation>[]);
    }
    if (translationUpdates.length > 0) {
      await I18nTranslation.bulkCreate(translationUpdates as CreationAttributes<I18nTranslation>[], {
        updateOnDuplicate: ["shortValue", "longValue", "language"]
      });
    }
    if (translatedItemIds.size > 0) {
      await I18nItem.bulkCreate(
        [...translatedItemIds].map(id => ({ id, status: "translated" })) as CreationAttributes<I18nItem>[],
        { updateOnDuplicate: ["status"], hooks: false }
      );
    }

    this.logger.log(
      `Finished localization key pull: processed=${processedItemIds.length}, translated=${translatedItemIds.size}, created=${translationCreations.length}, updated=${translationUpdates.length}`
    );
    return processedItemIds;
  }

  private async findAndAuthorize(entity: TranslatableEntity, uuid?: string | null) {
    switch (entity) {
      case "forms": {
        if (uuid == null || uuid === "") throw new BadRequestException("UUID is required for forms");
        const form = await Form.findOne({ where: { uuid } });
        if (form == null) throw new NotFoundException("Form not found");
        await this.policyService.authorize("update", form);
        return form;
      }
      case "fundingProgrammes": {
        if (uuid == null || uuid === "") throw new BadRequestException("UUID is required for funding programmes");
        const fundingProgramme = await FundingProgramme.findOne({ where: { uuid } });
        if (fundingProgramme == null) throw new NotFoundException("Funding programme not found");
        await this.policyService.authorize("update", fundingProgramme);
        return fundingProgramme;
      }
      case "localizationKeys": {
        await this.policyService.authorize("update", LocalizationKey);
        return null;
      }
      case "aboutSections": {
        if (uuid == null || uuid === "") throw new BadRequestException("UUID is required for about sections");
        const aboutSection = await AboutSection.findOne({ where: { uuid } });
        if (aboutSection == null) throw new NotFoundException("About section not found");
        await this.policyService.authorize("update", aboutSection);
        return aboutSection;
      }
    }
  }

  private getTranslationLabelEntityFields(translationEntity: TranslationModelType) {
    return translationEntity.I18N_FIELDS;
  }

  private getI18nLabelsFromEntity(entity: Model, labelFields: readonly string[]) {
    return Object.entries(entity.dataValues)
      .filter(([key, value]) => labelFields.includes(key) && value != null)
      .map(([, value]) => value as string);
  }

  private async processTranslationEntity<M extends TranslationModelType>(
    model: ModelCtor,
    property: string,
    filterParams: TranslationParamsType | TranslationParamsType[]
  ): Promise<[string[], InstanceType<M>[]]> {
    const filterParamsArray = Array.isArray(filterParams) ? filterParams : [filterParams];
    const labelFields = this.getTranslationLabelEntityFields(model as TranslationModelType);
    const entities = await model.findAll({
      where: {
        [property]: {
          [Op.in]: filterParamsArray
        }
      },
      attributes: intersection(Object.keys(model.getAttributes()), [...labelFields, ...EXTRA_FIELDS])
    });

    const labelsToBePushed = entities.flatMap(entity => this.getI18nLabelsFromEntity(entity, labelFields));

    return [labelsToBePushed, entities as InstanceType<M>[]];
  }

  async getI18nLabelsForAboutSection(aboutSection: AboutSection) {
    aboutSection.links ??= await aboutSection.$get("links");
    const aboutSectionLabels = this.getI18nLabelsFromEntity(
      aboutSection,
      this.getTranslationLabelEntityFields(AboutSection)
    );
    const linkLabels = (aboutSection.links ?? []).flatMap(link =>
      this.getI18nLabelsFromEntity(link, this.getTranslationLabelEntityFields(Link))
    );
    return uniq([...aboutSectionLabels, ...linkLabels]);
  }

  async getI18nLabelsForForm(form: Form) {
    const formI18nLabels = this.getI18nLabelsFromEntity(form, this.getTranslationLabelEntityFields(Form));
    const [formSectionI18nLabels, formSections] = await this.processTranslationEntity(FormSection, "formId", [
      form.uuid
    ]);
    const [formQuestionI18nLabels, formQuestions] = await this.processTranslationEntity(
      FormQuestion,
      "formSectionId",
      formSections.map(section => section.id)
    );
    const [formQuestionOptionI18nLabels] = await this.processTranslationEntity(
      FormQuestionOption,
      "formQuestionId",
      formQuestions.map(question => question.id)
    );
    const [formTableHeaderI18nLabels] = await this.processTranslationEntity(
      FormTableHeader,
      "formQuestionId",
      formQuestions.map(question => question.id)
    );
    const optionsListParams = formQuestions
      .map(question => (question as FormQuestion).optionsList)
      .filter((optionsList): optionsList is string => optionsList != null && optionsList !== "0");
    const [, formOptionsLists] = await this.processTranslationEntity(FormOptionList, "key", optionsListParams);
    const [formOptionListOptionI18nLabels] = await this.processTranslationEntity(
      FormOptionListOption,
      "formOptionListId",
      formOptionsLists.map(list => list.id)
    );

    const trackingEntryConfigLabels = formQuestions.flatMap(question =>
      getTrackingEntryConfigLabels((question as FormQuestion).additionalProps)
    );
    return [
      ...formI18nLabels,
      ...formSectionI18nLabels,
      ...formQuestionI18nLabels,
      ...formQuestionOptionI18nLabels,
      ...formTableHeaderI18nLabels,
      ...formOptionListOptionI18nLabels,
      ...trackingEntryConfigLabels
    ];
  }
}
