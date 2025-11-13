import {
  isCollectionModel,
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

export const polymorphicCollector = <T extends PolymorphicModel>(
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
    const hasCollection = dtoAttributes.includes("collection");

    return {
      addField(field, modelType, questionUuid) {
        if (hasCollection && field.collection == null) {
          throw new InternalServerErrorException(`Collection not found for ${modelType}`);
        }

        const key = `${modelType}:${hasCollection ? field.collection : ""}`;
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
              const attributes = {
                [typeAttribute]: laravelTypes[modelType],
                [idAttribute]: models[modelType].id
              } as Record<Attributes<T>, string | number>;
              if (hasCollection) attributes["collection"] = { [Op.in]: collections };
              return attributes as WhereAttributeHash<Attributes<T>>;
            })
          },
          attributes: dtoAttributes,
          include
        });

        for (const [key, questionUuid] of Object.entries(questions)) {
          const [modelType, collection] = key.split(":") as [FormModelType, string];
          answers[questionUuid] = modelInstances
            .filter(
              model =>
                model[typeAttribute] === laravelTypes[modelType] &&
                (!hasCollection || (isCollectionModel(model) && model.collection === collection))
            )
            .map(model => new dtoClass(model));
        }
      },

      syncRelation: (...args) => syncRelation(...args, logger)
    };
  };
