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
import { FormModel, FormModelType } from "@terramatch-microservices/database/constants/entities";
import { apiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { CountOptions } from "sequelize/lib/model";
import { Model, ModelCtor } from "sequelize-typescript";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";

type SyncArgs = [...Parameters<NonNullable<RelationResourceCollector["syncRelation"]>>, logger: LoggerService];
export type RelationSync = (...args: SyncArgs) => Promise<void>;

type DtoClass<M extends Model> = new (model: M) => { uuid?: string | null; collection?: string | null };

type SyncOptions = {
  // Explicitly set if this collector should expect and use a collection field. The default is to use the collection
  // field if it exists in the model attributes.
  usesCollection?: boolean;
};

type PolymorphicCollectorOptions = SyncOptions & {
  // If model associations should be fetched when loading the model, include here.
  include?: Includeable | Includeable[];
  // Include if the default polymorphicSync method does not work for this association.
  syncRelation?: RelationSync;
};

export const mapLaravelTypes = (models: FormModels) =>
  Object.entries(models).reduce((laravelTypes, [modelType, model]) => {
    const type = laravelType(model);
    if (type == null) throw new InternalServerErrorException(`No laravel type for model [${modelType}]`);
    return { ...laravelTypes, [modelType]: type };
  }, {} as Dictionary<string>);

export const scopedSync = <M extends UuidModel>(
  modelClass: ModelCtor<M>,
  dtoClass: DtoClass<M>,
  makeScope: (model: FormModel, field: LinkedRelation, hasCollection: boolean) => ModelCtor<M>,
  makeScopeAttributes: (
    model: FormModel,
    field: LinkedRelation,
    hasCollection: boolean
  ) => Partial<CreationAttributes<M>>,
  options: SyncOptions = {}
): RelationSync => {
  const modelAttributes = Object.keys(modelClass.getAttributes());
  const dtoAttributes = intersection(apiAttributes(dtoClass), modelAttributes);
  const assignableAttributes = dtoAttributes.filter(attr => !["uuid", "collection"].includes(attr));
  const hasCollection =
    options.usesCollection == null ? modelAttributes.includes("collection") : options.usesCollection;
  if (hasCollection && !isCollectionModelCtor(modelClass)) {
    throw new InternalServerErrorException("Collection not supported");
  }

  return async (model, field, answer, hidden, logger) => {
    if (hasCollection && field.collection == null) {
      throw new InternalServerErrorException(`Field missing collection ${field.inputType}`);
    }

    const answers = (answer ?? []) as InstanceType<typeof dtoClass>[];
    const answerUuids = answers.map(({ uuid }) => uuid).filter(isNotNull);
    const scope = makeScope(model, field, hasCollection);
    // the field.collection and collection model checks should always return true if hasCollection is true due to checks
    // above. They're only needed here to keep the TS compiler happy.
    const models = await scope.findAll();
    const toDestroy = models.map(({ uuid }) => uuid).filter(uuid => !answerUuids.includes(uuid));
    if (toDestroy.length > 0) {
      await modelClass.destroy({ where: { uuid: { [Op.in]: toDestroy } } as WhereAttributeHash<M> });
    }

    const scopeAttributes = makeScopeAttributes(model, field, hasCollection);
    const toCreate: CreationAttributes<M>[] = [];
    await Promise.all(
      answers.map(async answer => {
        if (hasCollection && answer.collection != null && answer.collection !== field.collection) {
          logger.error("Answer has an invalid collection set, ignoring", { answer, field });
        }

        const existing = models.find(({ uuid }) => uuid === answer.uuid);
        const updateAttributes = pick(answer, assignableAttributes);
        if (modelAttributes.includes("hidden")) updateAttributes["hidden"] = hidden;
        if (existing != null) {
          await existing.update(updateAttributes);
        } else {
          // count options requires a strong type to get the TS compiler to recognize the correct override
          const countOptions: Omit<CountOptions<Attributes<M>>, "group"> = {
            where: { uuid: answer.uuid },
            paranoid: false
          };
          // Keep the UUID from the client if one was provided, but protect against collisions in the DB
          const uuid = answer.uuid == null || (await modelClass.count(countOptions)) !== 0 ? undefined : answer.uuid;
          const collection = hasCollection && field.collection != null ? field.collection : undefined;
          toCreate.push({
            ...scopeAttributes,
            ...updateAttributes,
            uuid,
            collection
          } as unknown as CreationAttributes<M>);
        }
      })
    );

    if (toCreate.length > 0) await modelClass.bulkCreate(toCreate);
  };
};

export const polymorphicSync = <M extends PolymorphicModel & UuidModel>(
  modelClass: PolymorphicModelCtor<M>,
  dtoClass: new (model: M) => { uuid?: string | null; collection?: string | null },
  options: SyncOptions = {}
): RelationSync => {
  const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
  return scopedSync<M>(
    modelClass,
    dtoClass,
    (model, field, hasCollection) => {
      const scope = modelClass.for(model);
      return (
        hasCollection && field.collection != null && isCollectionModelCtor(scope)
          ? scope.collection(field.collection)
          : scope
      ) as ModelCtor<M>;
    },
    (model, field, hasCollection) =>
      ({
        [typeAttribute]: laravelType(model),
        [idAttribute]: model.id,
        collection: hasCollection ? field.collection : undefined
      } as unknown as Partial<CreationAttributes<M>>),
    options
  );
};

export const polymorphicCollector = <M extends PolymorphicModel & UuidModel>(
  modelClass: PolymorphicModelCtor<M>,
  dtoClass: new (model: M) => { uuid?: string | null; collection?: string | null },
  options: PolymorphicCollectorOptions = {}
) =>
  function (logger: LoggerService): RelationResourceCollector {
    const questions: Dictionary<string> = {};
    const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
    const modelAttributes = Object.keys(modelClass.getAttributes());
    const dtoAttributes = intersection(apiAttributes(dtoClass), modelAttributes) as Attributes<M>[];
    dtoAttributes.push(typeAttribute);
    const hasCollection =
      options.usesCollection == null ? modelAttributes.includes("collection") : options.usesCollection;
    const syncRelation = options.syncRelation ?? polymorphicSync(modelClass, dtoClass, options);

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
              } as Record<Attributes<M>, string | number>;
              if (hasCollection) attributes["collection"] = { [Op.in]: collections };
              return attributes as WhereAttributeHash<Attributes<M>>;
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
