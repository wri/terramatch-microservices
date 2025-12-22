import { Injectable } from "@nestjs/common";
import {
  Form,
  FormOptionList,
  FormOptionListOption,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader,
  FundingProgramme,
  LocalizationKey
} from "@terramatch-microservices/database/entities";
import { intersection } from "lodash";
import { Model, Op } from "sequelize";

type TranslationModelType =
  | typeof Form
  | typeof FormSection
  | typeof FormQuestion
  | typeof FormQuestionOption
  | typeof FormTableHeader
  | typeof FormOptionList
  | typeof FundingProgramme
  | typeof LocalizationKey
  | typeof FormOptionListOption;

type TranslationParamsType = string | number;

@Injectable()
export class LocalizationFormService {
  private extraFields: string[] = ["id", "optionsList"];

  private i18nIdsToBePushed: number[] = [];

  private getI18nTranslationEntityFields(translationEntity: TranslationModelType) {
    return translationEntity.I18N_FIELDS.map(field => `${field}Id`);
  }

  private async processTranslationEntity(
    model: TranslationModelType,
    property: string,
    filterParams: TranslationParamsType | TranslationParamsType[]
  ) {
    const filterParamsArray = Array.isArray(filterParams) ? filterParams : [filterParams];
    const i18nFields = this.getI18nTranslationEntityFields(model);
    // @ts-expect-error - entity is a model class
    const entities = await model.findAll({
      where: {
        [property]: {
          [Op.in]: filterParamsArray
        }
      },
      // @ts-expect-error - model is a model class
      attributes: intersection(Object.keys(model.getAttributes()), [...i18nFields, ...this.extraFields])
    });

    entities.forEach(entity => {
      this.pushI18nIds(entity, i18nFields);
    });

    return entities;
  }

  private pushI18nIds(entity: Model, i18nFields: string[]) {
    Object.entries(entity.dataValues).forEach(([key, value]) => {
      if (i18nFields.includes(key) && value != null) {
        this.i18nIdsToBePushed.push(value as number);
      }
    });
  }

  async getI18nIdsForForm(form: Form) {
    this.pushI18nIds(form, this.getI18nTranslationEntityFields(Form));
    const formSections = await this.processTranslationEntity(FormSection, "formId", [form.uuid]);
    const formQuestions = await this.processTranslationEntity(
      FormQuestion,
      "formSectionId",
      formSections.map(section => section.id)
    );
    await this.processTranslationEntity(
      FormTableHeader,
      "formQuestionId",
      formQuestions.map(question => question.id)
    );
    const optionsListParams = formQuestions
      // @ts-expect-error - optionsList is a field of FormQuestion
      .map(question => question.optionsList)
      .filter(optionsList => optionsList != null)
      .filter(optionsList => optionsList != "0");
    const formOptionsLists = await this.processTranslationEntity(FormOptionList, "key", optionsListParams);
    await this.processTranslationEntity(
      FormOptionListOption,
      "formOptionListId",
      formOptionsLists.map(list => list.id)
    );
    return this.i18nIdsToBePushed;
  }
}
