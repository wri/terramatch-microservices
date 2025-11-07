import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import {
  Demographic,
  DisturbanceReport,
  FinancialReport,
  Form,
  FormQuestion,
  FormSection,
  Media,
  ProjectPolygon
} from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { EntityModel, FormModel, FormModelType, isEntity } from "@terramatch-microservices/database/constants/entities";
import { Dictionary } from "lodash";
import { Op } from "sequelize";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  isField,
  isFile,
  isRelation,
  LinkedField,
  LinkedFieldResource,
  LinkedFile,
  LinkedRelation
} from "@terramatch-microservices/database/constants/linked-fields";
import { isMediaOwner, mediaConfiguration } from "@terramatch-microservices/database/constants/media-owners";
import { EmbeddedMediaDto } from "./dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EmbeddedDemographicDto } from "./dto/demographic.dto";

@Injectable()
export class FormDataService {
  private logger = new TMLogger(FormDataService.name);

  constructor(private readonly localizationService: LocalizationService, private readonly mediaService: MediaService) {}

  async getForm(model: EntityModel) {
    if (model instanceof FinancialReport) {
      return await Form.findOne({ where: { type: "financial-report" } });
    }
    if (model instanceof DisturbanceReport) {
      return await Form.findOne({ where: { type: "disturbance-report" } });
    }

    return await Form.findOne({ where: { model: laravelType(model), frameworkKey: model.frameworkKey } });
  }

  async getFormTitle(form: Form, locale: ValidLocale) {
    const ids = form.titleId == null ? [] : [form.titleId];
    const translations = await this.localizationService.translateIds(ids, locale);
    return this.localizationService.translateFields(translations, form, ["title"]).title;
  }

  // TODO TM-2581 should accept multiple model types
  async getAnswers(form: Form, models: FormModels, answersModel?: { answers: object | null }) {
    const answers: Dictionary<unknown> = {};
    if (answersModel == null) {
      const modelValues = Object.values(models);
      if (modelValues.length !== 1) {
        throw new InternalServerErrorException("Expected exactly one model if no answers model is provided");
      }
      if (!isEntity(modelValues[0])) {
        throw new InternalServerErrorException("Expected entity model if no answers model is provided");
      }
      answersModel = modelValues[0];
    }
    const modelAnswers = answersModel?.answers ?? {};

    const questions = await FormQuestion.findAll({
      where: { formSectionId: { [Op.in]: FormSection.forForm(form.uuid) } }
    });

    const collectors = makeCollectors(this.logger, this.mediaService);
    for (const question of questions) {
      const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
      if (config == null) {
        // TODO create a collector
        answers[question.uuid] = modelAnswers?.[question.uuid];
      } else {
        if (isField(config.field)) collectors.fields.addField(config.field, config.model, question.uuid);
        else if (isFile(config.field)) collectors.files.addField(config.field, config.model, question.uuid);
        else if (isRelation(config.field)) {
          // TODO when not partial, remove safe navigation
          collectors[config.field.resource]?.addField(config.field, config.model, question.uuid);
        }
      }
    }

    await collectors.collect(answers, models);

    return answers;
  }
}

type FormTypeMap<T> = Partial<Record<FormModelType, T>>;
type FormModels = FormTypeMap<FormModel>;

// TODO make not partial
type Collectors = Partial<Record<LinkedFieldResource, ResourceCollector<LinkedRelation>>> & {
  fields: ResourceCollector<LinkedField>;
  files: ResourceCollector<LinkedFile>;

  collect(answers: Dictionary<unknown>, models: FormModels): Promise<void>;
};

const makeCollectors = (logger: TMLogger, mediaService: MediaService): Collectors => {
  const fields = fieldCollector(logger);
  const files = fileCollector(logger, mediaService);
  const relationCollectors = {} as Partial<Record<LinkedFieldResource, ResourceCollector<LinkedRelation>>>;
  return {
    async collect(answers, models) {
      await Promise.all(
        [fields, files, ...Object.values(relationCollectors)].map(collector => collector.collect(answers, models))
      );
    },

    fields,
    files,

    get demographics() {
      return relationCollectors.demographics ?? (relationCollectors.demographics = demographicsCollector(logger));
    }
  };
};

const mapLaravelTypes = (models: FormModels) =>
  Object.entries(models).reduce((laravelTypes, [modelType, model]) => {
    const type = laravelType(model);
    if (type == null) throw new InternalServerErrorException(`No laravel type for model [${modelType}]`);
    return { ...laravelTypes, [modelType]: type };
  }, {} as Dictionary<string>);

type ResourceCollector<TField extends LinkedField | LinkedFile | LinkedRelation> = {
  addField(field: TField, modelType: FormModelType, questionUuid: string): void;
  collect(answers: Dictionary<unknown>, models: FormModels): Promise<void>;
};

function fieldCollector(logger: TMLogger): ResourceCollector<LinkedField> {
  const polygonQuestions: Dictionary<string> = {};
  const propertyQuestions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      if (field.inputType === "mapInput" || field.property === "proj_boundary") {
        if (polygonQuestions[modelType] != null) {
          logger.warn(`Duplicate polygon field for model type ${modelType}`);
        }
        this.polygonQuestions[modelType] = questionUuid;
      } else {
        const key = `${modelType}:${field.property}`;
        if (propertyQuestions[key] != null) {
          logger.warn(`Duplicate property field [${modelType}, ${field.property}]`);
        }
        propertyQuestions[key] = questionUuid;
      }
    },

    async collect(answers, models) {
      for (const [key, questionUuid] of Object.entries(propertyQuestions)) {
        const [modelType, property] = key.split(":") as [FormModelType, string];
        if (models[modelType] == null) logger.error(`Model for type not found: ${modelType}`);
        else answers[questionUuid] = models[modelType][property];
      }

      // There should never really be more than one of these per form, so looping is fine here.
      for (const [modelType, questionUuid] of Object.entries(polygonQuestions)) {
        const model = models[modelType];
        if (model == null) {
          logger.error(`Model for type not found: ${modelType}`);
          continue;
        }

        const polygon = await ProjectPolygon.findOne({
          where: { entityType: laravelType(model), entityId: model.id },
          order: [["createdAt", "DESC"]],
          include: ["polygon"]
        });
        if (polygon != null) {
          answers[questionUuid] = polygon.polygon;
        }
      }
    }
  };
}

function fileCollector(logger: TMLogger, mediaService: MediaService): ResourceCollector<LinkedFile> {
  const questions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      const key = `${modelType}:${field.property}`;
      if (questions[key] != null) logger.warn(`Duplicate file field [${modelType}, ${field.property}]`);
      questions[key] = questionUuid;
    },

    async collect(answers, models) {
      const collectionsByModel = Object.keys(questions).reduce((byModel, key) => {
        const [modelType, collection] = key.split(":") as [FormModelType, string];
        return { ...byModel, [modelType]: [...(byModel[modelType] ?? []), collection] };
      }, {} as FormTypeMap<string[]>);

      const laravelTypes = mapLaravelTypes(models);
      const medias = await Media.findAll({
        where: {
          [Op.or]: Object.entries(collectionsByModel).map(([modelType, collections]) => {
            if (models[modelType] == null) {
              throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
            }
            return {
              modelType: laravelTypes[modelType],
              modelId: models[modelType].id,
              collectionName: { [Op.in]: collections }
            };
          })
        }
      });

      for (const [key, questionUuid] of Object.entries(questions)) {
        const [modelType, collection] = key.split(":") as [FormModelType, string];
        if (!isMediaOwner(modelType))
          throw new InternalServerErrorException(`Entity is not a media owner: ${modelType}`);

        const configuration = mediaConfiguration(modelType, collection);
        if (configuration == null) {
          throw new InternalServerErrorException(`Media configuration not found: [${modelType}, ${collection}]`);
        }

        const media = medias.filter(
          media => media.collectionName === collection && media.modelType === laravelTypes[modelType]
        );
        const createDto = (media: Media) =>
          new EmbeddedMediaDto(media, {
            url: mediaService.getUrl(media),
            thumbUrl: mediaService.getUrl(media, "thumbnail")
          });
        if (configuration.multiple) {
          answers[questionUuid] = media.length == 0 ? undefined : media.map(createDto);
        } else {
          if (media.length > 1) {
            logger.warn("Found multiple media for a singular media definition, returning first", {
              modelType,
              uuid: models[modelType]?.uuid,
              collection: collection
            });
          }
          answers[questionUuid] = media.length === 0 ? undefined : createDto(media[0]);
        }
      }
    }
  };
}

function demographicsCollector(logger: TMLogger): ResourceCollector<LinkedRelation> {
  const questions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      if (field.collection == null) {
        throw new InternalServerErrorException(
          `Collection not found for demographics field [${modelType}, ${field.property}]`
        );
      }

      const key = `${modelType}:${field.collection}`;
      if (questions[key] != null) {
        logger.warn(`Duplicate collection for demographics field ${key}`);
      }

      questions[key] = questionUuid;
    },

    async collect(answers, models) {
      const collectionsByModel = Object.keys(questions).reduce((byModel, key) => {
        const [modelType, collection] = key.split(":") as [FormModelType, string];
        return { ...byModel, [modelType]: [...(byModel[modelType] ?? []), collection] };
      }, {} as FormTypeMap<string[]>);

      const laravelTypes = mapLaravelTypes(models);
      const demographics = await Demographic.findAll({
        where: {
          [Op.or]: Object.entries(collectionsByModel).map(([modelType, collections]) => {
            if (models[modelType] == null) {
              throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
            }
            return {
              demographicalType: laravelTypes[modelType],
              demographicalId: models[modelType].id,
              collection: { [Op.in]: collections }
            };
          })
        },
        attributes: ["uuid", "collection", "demographicalType"],
        include: [{ association: "entries" }]
      });

      for (const [key, questionUuid] of Object.entries(questions)) {
        const [modelType, collection] = key.split(":") as [FormModelType, string];
        const demographic = demographics.find(
          demographic =>
            demographic.collection === collection && demographic.demographicalType === laravelTypes[modelType]
        );
        if (demographic != null) {
          answers[questionUuid] = new EmbeddedDemographicDto(demographic);
        }
      }
    }
  };
}
