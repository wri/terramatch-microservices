import { Tracking, TrackingEntry } from "@terramatch-microservices/database/entities";
import { EmbeddedTrackingDto, TrackingEntryDto } from "../../dto/tracking.dto";
import { mapLaravelTypes, RelationSync } from "./utils";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { Dictionary, intersection, isEqualWith, kebabCase } from "lodash";
import { Op, WhereOptions } from "sequelize";
import { TrackingDomain, TrackingType } from "@terramatch-microservices/database/types/tracking";
import { FormTypeMap, RelationResourceCollector } from "./index";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { apiAttributes } from "../../dto/json-api-attributes";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";

// For each of type, subtype and name, ensure predicate returns true if either they have an identical value,
// or both are null / undefined.
const entryMatches = (a: TrackingEntry | TrackingEntryDto, b: TrackingEntry | TrackingEntryDto) =>
  isEqualWith(
    { type: a.type, subtype: a.subtype, name: a.name },
    { type: b.type, subtype: b.subtype, name: b.name },
    (valueA, valueB) => (valueA == null && valueB == null ? true : undefined)
  );

const trackingProps = ({ resource, inputType, collection }: LinkedRelation) => {
  const domain = resource as TrackingDomain;
  const type = kebabCase(inputType) as TrackingType;
  if (!Tracking.DOMAINS.includes(domain) || !Tracking.VALID_TYPES.includes(type) || collection == null) {
    throw new InternalServerErrorException(`Invalid tracking field definition [${domain}, ${type}, ${collection}]`);
  }

  return { domain, type, collection };
};

const syncTrackings: RelationSync = async (model, field, answer, hidden, logger) => {
  const { domain, type, collection } = trackingProps(field);
  const scope = Tracking.for(model).domain(domain).type(type).collection(collection);

  // Trackings have only one answer per linked field.
  const dto = ((answer ?? []) as EmbeddedTrackingDto[])[0];
  if (dto == null) {
    await scope.destroy();
    return;
  }

  if (dto.collection != null && dto.collection !== field.collection) {
    logger.error("Answer has an invalid collection set, ignoring answer collection", { answer, field });
  }

  let tracking = await scope.findOne();
  if (tracking == null) {
    tracking = await Tracking.create({
      trackableType: laravelType(model),
      trackableId: model.id,
      domain,
      type,
      collection,
      hidden
    });
  } else {
    await tracking.update({ hidden });
  }

  // Make sure the incoming data is clean, and meets our expectations of one row per type/subtype/name combo.
  // The FE is not supposed to send us data with duplicates, but there has been a bug in the past that caused
  // this problem, so this extra check is just covering our bases.
  const entryDtos = (dto.entries ?? []).reduce((entries, entry) => {
    for (const row of entries) {
      if (entryMatches(row, entry)) {
        row["amount"] = entry.amount;
        return entries;
      }
    }

    return [...entries, entry];
  }, [] as TrackingEntryDto[]);

  const currentEntries = await TrackingEntry.tracking(tracking.id).findAll();
  const includedEntryIds: number[] = [];
  await Promise.all(
    entryDtos.map(async entryDto => {
      let entry = currentEntries.find(entry => entryMatches(entry, entryDto));
      if (entry == null) {
        entry = await TrackingEntry.create({
          type: entryDto.type,
          subtype: entryDto.subtype,
          name: entryDto.name,
          amount: entryDto.amount,
          trackingId: tracking.id
        });
      } else {
        await entry.update({ amount: entryDto.amount });
      }

      includedEntryIds.push(entry.id);
    })
  );

  // Remove any existing entry that wasn't in the submitted set.
  await TrackingEntry.destroy({ where: { trackingId: tracking.id, id: { [Op.notIn]: includedEntryIds } } });
};

const makeKey = (field: LinkedRelation, modelType: FormModelType) => {
  const { domain, type, collection } = trackingProps(field);
  return `${modelType}:${domain}:${type}:${collection}`;
};

const parseKey = (key: string) => {
  const [modelType, domain, type, collection] = key.split(":") as [FormModelType, TrackingDomain, TrackingType, string];
  return { modelType, domain, type, collection };
};

type ModelKey = { domain: TrackingDomain; type: TrackingType; collection: string };

// Since trackings is the only model that disambiguates on more than just 'collection', the
// base polymorphic collector is not sufficient.
export const trackingsCollector = function (logger: LoggerService): RelationResourceCollector {
  const questions: Dictionary<string> = {};
  const modelAttributes = Object.keys(Tracking.getAttributes());
  const dtoAttributes = ["trackableType", ...intersection(apiAttributes(EmbeddedTrackingDto), modelAttributes)];

  return {
    addField(field, modelType, questionUuid) {
      const key = makeKey(field, modelType);
      if (questions[key] != null) {
        logger.warn(`Duplicate collection for field ${key}`);
      }

      questions[key] = questionUuid;
    },

    async collect(answers, models) {
      const keysByModel = Object.keys(questions).reduce((byModel, key) => {
        const { modelType, domain, type, collection } = parseKey(key);
        return { ...byModel, [modelType]: [...(byModel[modelType] ?? []), { domain, type, collection }] };
      }, {} as FormTypeMap<ModelKey[]>);

      const laravelTypes = mapLaravelTypes(models);
      const trackings = await Tracking.findAll({
        where: {
          [Op.or]: Object.entries(keysByModel).map(([modelType, keys]): WhereOptions<Tracking> => {
            if (models[modelType] == null) {
              throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
            }

            return {
              trackableType: laravelTypes[modelType],
              trackableId: models[modelType].id,
              [Op.or]: keys.map(
                ({ domain, type, collection }): WhereOptions<Tracking> => ({ domain, type, collection })
              )
            };
          })
        },
        attributes: dtoAttributes,
        include: [{ association: "entries" }]
      });

      for (const [key, questionUuid] of Object.entries(questions)) {
        const { modelType, domain, type, collection } = parseKey(key);
        const tracking = trackings.find(
          tracking =>
            tracking.trackableType === laravelTypes[modelType] &&
            tracking.domain === domain &&
            tracking.type === type &&
            tracking.collection === collection
        );
        if (tracking != null) answers[questionUuid] = [new EmbeddedTrackingDto(tracking)];
      }
    },

    syncRelation: (...args) => syncTrackings(...args, logger),

    async clearRelations(model) {
      await TrackingEntry.tracking(Tracking.idsSubquery([model.id], laravelType(model))).destroy();
      await Tracking.for(model).destroy();
    }
  };
};
