import {
  isCollectionModel,
  isCollectionModelCtor,
  laravelType,
  polymorphicAttributes,
  PolymorphicModel,
  PolymorphicModelCtor,
  UuidModel
} from "@terramatch-microservices/database/types/util";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { Dictionary, intersection, pick } from "lodash";
import { FormModels, FormTypeMap, RelationResourceCollector } from "./index";
import { Attributes, CreationAttributes, Includeable, Op, WhereAttributeHash } from "sequelize";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { apiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { CountOptions } from "sequelize/lib/model";

type SyncArgs = [...Parameters<NonNullable<RelationResourceCollector["syncRelation"]>>, logger: LoggerService];
export type RelationSync = (...args: SyncArgs) => Promise<void>;

export const mapLaravelTypes = (models: FormModels) =>
  Object.entries(models).reduce((laravelTypes, [modelType, model]) => {
    const type = laravelType(model);
    if (type == null) throw new InternalServerErrorException(`No laravel type for model [${modelType}]`);
    return { ...laravelTypes, [modelType]: type };
  }, {} as Dictionary<string>);

export const polymorphicSync = <T extends PolymorphicModel & UuidModel>(
  modelClass: PolymorphicModelCtor<T>,
  dtoClass: new (model: T) => { uuid?: string | null; collection?: string | null }
): RelationSync => {
  const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
  const modelAttributes = Object.keys(modelClass.getAttributes());
  const dtoAttributes = intersection(apiAttributes(dtoClass), modelAttributes);
  const assignableAttributes = dtoAttributes.filter(attr => !["uuid", "collection"].includes(attr));
  const hasCollection = modelAttributes.includes("collection");
  if (hasCollection && !isCollectionModelCtor(modelClass)) {
    throw new InternalServerErrorException("Collection not supported");
  }

  return async (model, field, answer, hidden, logger) => {
    if (hasCollection && field.collection == null) {
      throw new InternalServerErrorException(`Field missing collection ${field.inputType}`);
    }

    const answers = (answer ?? []) as InstanceType<typeof dtoClass>[];
    const answerUuids = answers.map(({ uuid }) => uuid).filter(isNotNull);
    const scope = modelClass.for(model);
    // the field.collection and collection model checks should always return true if hasCollection is true due to checks
    // above. They're only needed here to keep the TS compiler happy.
    const models = (await (hasCollection && field.collection != null && isCollectionModelCtor(scope)
      ? scope.collection(field.collection)
      : scope
    ).findAll()) as T[];
    const toDestroy = models.map(({ uuid }) => uuid).filter(uuid => !answerUuids.includes(uuid));
    if (toDestroy.length > 0) {
      await modelClass.destroy({ where: { uuid: { [Op.in]: toDestroy } } as WhereAttributeHash<T> });
    }

    const toCreate: CreationAttributes<T>[] = [];
    await Promise.all(
      answers.map(async answer => {
        if (hasCollection && answer.collection != null && answer.collection !== field.collection) {
          logger.error("Answer has an invalid collection set, ignoring", { answer, field });
        }

        const current = models.find(({ uuid }) => uuid === answer.uuid);
        if (current != null) {
          await current.update({ ...pick(answer, assignableAttributes), hidden });
        } else {
          // count options requires a strong type to get the TS compiler to recognize the correct override
          const countOptions: Omit<CountOptions<Attributes<T>>, "group"> = {
            where: { uuid: answer.uuid },
            paranoid: false
          };
          // Keep the UUID from the client if one was provided, but protect against collisions in the DB
          const uuid = answer.uuid == null || (await modelClass.count(countOptions)) !== 0 ? undefined : answer.uuid;
          const collection = hasCollection && field.collection != null ? field.collection : undefined;
          toCreate.push({
            [typeAttribute]: laravelType(model),
            [idAttribute]: model.id,
            ...pick(answer, assignableAttributes),
            uuid,
            collection,
            hidden
          } as unknown as CreationAttributes<T>);
        }
      })
    );

    if (toCreate.length > 0) {
      await modelClass.bulkCreate(toCreate);
    }
  };
};

type PolymorphicCollectorOptions = {
  // If model associations should be fetched when loading the model, include here.
  include?: Includeable | Includeable[];
  // Explicitly set if this collector should expect and use a collection field. The default is to use the collection
  // field if it exists in the model attributes.
  usesCollection?: boolean;
  // Include if the default polymorphicSync method does not work for this association.
  syncRelation?: RelationSync;
};

export const polymorphicCollector = <T extends PolymorphicModel & UuidModel>(
  modelClass: PolymorphicModelCtor<T>,
  dtoClass: new (model: T) => { uuid?: string | null; collection?: string | null },
  options: PolymorphicCollectorOptions = {}
) =>
  function (logger: LoggerService): RelationResourceCollector {
    const questions: Dictionary<string> = {};
    const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
    const modelAttributes = Object.keys(modelClass.getAttributes());
    const dtoAttributes = intersection(apiAttributes(dtoClass), modelAttributes) as Attributes<T>[];
    dtoAttributes.push(typeAttribute);
    const hasCollection =
      options.usesCollection == null ? modelAttributes.includes("collection") : options.usesCollection;
    const syncRelation = options.syncRelation ?? polymorphicSync(modelClass, dtoClass);

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
          include: options.include
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
