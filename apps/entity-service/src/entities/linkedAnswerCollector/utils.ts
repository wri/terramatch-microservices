import {
  CollectionModel,
  laravelType,
  polymorphicAttributes,
  PolymorphicModel,
  PolymorphicModelCtor
} from "@terramatch-microservices/database/types/util";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { Dictionary, intersection } from "lodash";
import { FormModels, FormTypeMap, RelationResourceCollector } from "./index";
import { Attributes, Includeable, Op, WhereAttributeHash } from "sequelize";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { apiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

type SyncArgs = [...Parameters<NonNullable<RelationResourceCollector["syncRelation"]>>, logger: LoggerService];
export type RelationSync = (...args: SyncArgs) => Promise<void>;

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
export const singleAssociationCollection = <T extends PolymorphicModel>(
  modelClass: PolymorphicModelCtor<T>,
  dtoClass: new (model: T) => unknown,
  syncRelation: RelationSync,
  include?: Includeable | Includeable[]
) =>
  function (logger: LoggerService): RelationResourceCollector {
    const questions: Dictionary<string> = {};
    const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
    const dtoAttributes = intersection(
      apiAttributes(dtoClass),
      Object.keys(modelClass.getAttributes())
    ) as Attributes<T>[];
    dtoAttributes.push(typeAttribute);

    return {
      addField(_, modelType, questionUuid) {
        if (questions[modelType] != null) {
          logger.warn(`Duplicate field for ${modelType}`);
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
          attributes: dtoAttributes,
          include
        });

        for (const [key, questionUuid] of Object.entries(questions)) {
          answers[questionUuid] = modelInstances
            .filter(model => model[typeAttribute] === laravelTypes[key])
            .map(model => new dtoClass(model));
        }
      },

      syncRelation: (...args) => syncRelation(...args, logger)
    };
  };

/**
 * Creates a ResourceCollector factory for resources that distinguish based on a collection attribute.
 */
export const collectionCollector = <T extends CollectionModel & PolymorphicModel>(
  modelClass: PolymorphicModelCtor<T>,
  dtoClass: new (model: T) => unknown,
  syncRelation: (...args: SyncArgs) => Promise<void>,
  include?: Includeable | Includeable[]
) =>
  function (logger: LoggerService): RelationResourceCollector {
    const questions: Dictionary<string> = {};
    const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
    const dtoAttributes = intersection(
      apiAttributes(dtoClass),
      Object.keys(modelClass.getAttributes())
    ) as Attributes<T>[];
    dtoAttributes.push(typeAttribute);

    return {
      addField(field, modelType, questionUuid) {
        if (field.collection == null) {
          throw new InternalServerErrorException(`Collection not found for ${modelType}`);
        }

        const key = `${modelType}:${field.collection}`;
        if (questions[key] != null) {
          logger.warn(`Duplicate collection for field ${key}`);
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
          attributes: dtoAttributes,
          include
        });

        for (const [key, questionUuid] of Object.entries(questions)) {
          const [modelType, collection] = key.split(":") as [FormModelType, string];
          answers[questionUuid] = modelInstances
            .filter(model => model.collection === collection && model[typeAttribute] === laravelTypes[modelType])
            .map(model => new dtoClass(model));
        }
      },

      syncRelation: (...args) => syncRelation(...args, logger)
    };
  };
