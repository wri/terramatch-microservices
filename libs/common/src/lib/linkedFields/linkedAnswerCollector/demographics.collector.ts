import { Demographic, DemographicEntry } from "@terramatch-microservices/database/entities";
import { DemographicEntryDto, EmbeddedDemographicDto } from "../../dto/demographic.dto";
import { mapLaravelTypes, RelationSync } from "./utils";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { Dictionary, intersection, kebabCase } from "lodash";
import { Op, WhereOptions } from "sequelize";
import { DemographicType } from "@terramatch-microservices/database/types/demographic";
import { FormTypeMap, RelationResourceCollector } from "./index";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { apiAttributes } from "../../dto/json-api-attributes";

// For each of type, subtype and name, ensure predicate returns true if either they have an identical value,
// or both are null / undefined.
const entryMatches = (a: DemographicEntry | DemographicEntryDto, b: DemographicEntry | DemographicEntryDto) => {
  if ((a.type == null) !== (b.type == null) || (a.type != null && a.type !== b.type)) return false;
  if ((a.subtype == null) !== (b.subtype == null) || (a.subtype != null && a.subtype !== b.subtype)) return false;
  if ((a.name == null) !== (b.name == null) || (a.name != null && a.name !== b.name)) return false;
  return true;
};

const syncDemographics: RelationSync = async (model, field, answer, hidden, logger) => {
  if (field.collection == null) {
    throw new InternalServerErrorException(`Collection not found for ${field.inputType}`);
  }

  // Demographics have only one answer per linked field.
  const dto = ((answer ?? []) as EmbeddedDemographicDto[])[0];
  if (dto == null) {
    await Demographic.for(model).collection(field.collection).destroy();
    return;
  }

  if (dto.collection != null && dto.collection !== field.collection) {
    logger.error("Answer has an invalid collection set, ignoring answer collection", { answer, field });
  }

  let demographic = await Demographic.for(model).collection(field.collection).findOne();
  if (demographic == null) {
    demographic = await Demographic.create({
      demographicalType: laravelType(model),
      demographicalId: model.id,
      type: kebabCase(field.inputType) as DemographicType,
      collection: field.collection,
      hidden
    });
  } else {
    await demographic.update({ hidden });
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
  }, [] as DemographicEntryDto[]);

  const currentEntries = await DemographicEntry.demographic(demographic.id).findAll();
  const includedEntryIds: number[] = [];
  await Promise.all(
    entryDtos.map(async entryDto => {
      let entry = currentEntries.find(entry => entryMatches(entry, entryDto));
      if (entry == null) {
        entry = await DemographicEntry.create({
          type: entryDto.type,
          subtype: entryDto.subtype,
          name: entryDto.name,
          amount: entryDto.amount,
          demographicId: demographic.id
        });
      } else {
        await entry.update({ amount: entryDto.amount });
      }

      includedEntryIds.push(entry.id);
    })
  );

  // Remove any existing entry that wasn't in the submitted set.
  await DemographicEntry.destroy({ where: { demographicId: demographic.id, id: { [Op.notIn]: includedEntryIds } } });
};

// Since demographics is the only model that disambiguates on more than just collection, the
// base polymorphic collector is not sufficient.
export const demographicsCollector = function (logger: LoggerService): RelationResourceCollector {
  const questions: Dictionary<string> = {};
  const modelAttributes = Object.keys(Demographic.getAttributes());
  const dtoAttributes = ["demographicalType", ...intersection(apiAttributes(EmbeddedDemographicDto), modelAttributes)];

  return {
    addField(field, modelType, questionUuid) {
      if (field.collection == null) {
        throw new InternalServerErrorException(`Collection not found for ${modelType}`);
      }

      const key = `${modelType}:${kebabCase(field.inputType)}:${field.collection}`;
      if (questions[key] != null) {
        logger.warn(`Duplicate collection for field ${key}`);
      }

      questions[key] = questionUuid;
    },

    async collect(answers, models) {
      // results in a mapping of model type to an array of keys. Each key is [type, collection] (see addField)
      const keysByModel = Object.keys(questions).reduce((byModel, key) => {
        const [modelType, type, collection] = key.split(":") as [FormModelType, string, string];
        return { ...byModel, [modelType]: [...(byModel[modelType] ?? []), [type, collection]] };
      }, {} as FormTypeMap<string[][]>);

      const laravelTypes = mapLaravelTypes(models);
      const demographics = await Demographic.findAll({
        where: {
          [Op.or]: Object.entries(keysByModel).map(([modelType, keys]): WhereOptions<Demographic> => {
            if (models[modelType] == null) {
              throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
            }

            return {
              demographicalType: laravelTypes[modelType],
              demographicalId: models[modelType].id,
              [Op.or]: keys.map(([type, collection]): WhereOptions<Demographic> => ({ type, collection }))
            };
          })
        },
        attributes: dtoAttributes,
        include: [{ association: "entries" }]
      });

      for (const [key, questionUuid] of Object.entries(questions)) {
        const [modelType, type, collection] = key.split(":") as [FormModelType, string, string];
        const demographic = demographics.find(
          demographic =>
            demographic.demographicalType === laravelTypes[modelType] &&
            demographic.type === type &&
            demographic.collection === collection
        );
        if (demographic != null) answers[questionUuid] = [new EmbeddedDemographicDto(demographic)];
      }
    },

    syncRelation: (...args) => syncDemographics(...args, logger)
  };
};
