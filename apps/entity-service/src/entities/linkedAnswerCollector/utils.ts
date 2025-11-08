import { laravelType } from "@terramatch-microservices/database/types/util";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { Dictionary } from "lodash";
import { FormModels, FormTypeMap, ResourceCollector } from "./index";
import { LinkedFieldResource, LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { Attributes, FindOptions, Model, ModelStatic, Op, WhereAttributeHash } from "sequelize";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";

export const mapLaravelTypes = (models: FormModels) =>
  Object.entries(models).reduce((laravelTypes, [modelType, model]) => {
    const type = laravelType(model);
    if (type == null) throw new InternalServerErrorException(`No laravel type for model [${modelType}]`);
    return { ...laravelTypes, [modelType]: type };
  }, {} as Dictionary<string>);

/**
 * Creates a ResourceCollector factory for resources that do not distinguish via collection or another method
 * against a single base model.
 */
export const singleAssociationCollection = <T extends Model>(
  resource: LinkedFieldResource,
  modelClass: ModelStatic<T>,
  typeAttribute: keyof Attributes<T>,
  idAttribute: keyof Attributes<T>,
  findOptions: Omit<FindOptions<Attributes<T>>, "where">,
  createDto: (model: T) => unknown
) =>
  function (logger: LoggerService): ResourceCollector<LinkedRelation> {
    const questions: Dictionary<string> = {};

    return {
      addField(_, modelType, questionUuid) {
        if (questions[modelType] != null) {
          logger.warn(`Duplicate field for ${resource} with ${modelType}`);
        }
        questions[modelType] = questionUuid;
      },

      async collect(answers, models) {
        const laravelTypes = mapLaravelTypes(models);
        const modelInstances = await modelClass.findAll({
          where: {
            [Op.or]: Object.keys(questions).map((modelType: FormModelType) => {
              if (models[modelType] == null) {
                throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
              }
              return {
                [typeAttribute]: laravelTypes[modelType],
                [idAttribute]: models[modelType].id
              } as WhereAttributeHash<Attributes<T>>;
            })
          },
          ...findOptions
        });

        for (const [key, questionUuid] of Object.entries(questions)) {
          answers[questionUuid] = modelInstances
            .filter(model => model[typeAttribute] === laravelTypes[key])
            .map(createDto);
        }
      }
    };
  };

/**
 * Creates a ResourceCollector factory for resources that distinguish based on a collection attribute.
 */
export const collectionCollector = <T extends Model & { collection: string | null }>(
  resource: LinkedFieldResource,
  modelClass: ModelStatic<T>,
  typeAttribute: keyof Attributes<T>,
  idAttribute: keyof Attributes<T>,
  findOptions: Omit<FindOptions<Attributes<T>>, "where">,
  createDto: (model: T) => unknown
) =>
  function (logger: LoggerService): ResourceCollector<LinkedRelation> {
    const questions: Dictionary<string> = {};

    return {
      addField(field, modelType, questionUuid) {
        if (field.collection == null) {
          throw new InternalServerErrorException(`Collection not found for ${resource} fo ${modelType}`);
        }

        const key = `${modelType}:${field.collection}`;
        if (questions[key] != null) {
          logger.warn(`Duplicate collection for ${resource} field ${key}`);
        }

        questions[key] = questionUuid;
      },

      async collect(answers, models) {
        const collectionsByModel = Object.keys(questions).reduce((byModel, key) => {
          const [modelType, collection] = key.split(":") as [FormModelType, string];
          return { ...byModel, [modelType]: [...(byModel[modelType] ?? []), collection] };
        }, {} as FormTypeMap<string[]>);

        const laravelTypes = mapLaravelTypes(models);
        const modelInstances = await modelClass.findAll({
          where: {
            [Op.or]: Object.entries(collectionsByModel).map(([modelType, collections]) => {
              if (models[modelType] == null) {
                throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
              }
              return {
                [typeAttribute]: laravelTypes[modelType],
                [idAttribute]: models[modelType].id,
                collection: { [Op.in]: collections }
              };
            })
          },
          ...findOptions
        });

        for (const [key, questionUuid] of Object.entries(questions)) {
          const [modelType, collection] = key.split(":") as [FormModelType, string];
          answers[questionUuid] = modelInstances
            .filter(model => model.collection === collection && model[typeAttribute] === laravelTypes[modelType])
            .map(createDto);
        }
      }
    };
  };
