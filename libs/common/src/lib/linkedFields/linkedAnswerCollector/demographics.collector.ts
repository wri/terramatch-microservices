import { Demographic, DemographicEntry } from "@terramatch-microservices/database/entities";
import { DemographicEntryDto, EmbeddedDemographicDto } from "../../dto/demographic.dto";
import { polymorphicCollector, RelationSync } from "./utils";
import { InternalServerErrorException } from "@nestjs/common";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { kebabCase } from "lodash";
import { Op } from "sequelize";
import { DemographicType } from "@terramatch-microservices/database/types/demographic";

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
    logger.error("Answer has an invalid collection set, ignoring", { answer, field });
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

  const currentEntries = await DemographicEntry.findAll({ where: { demographicId: demographic.id } });
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

export const demographicsCollector = polymorphicCollector(Demographic, EmbeddedDemographicDto, {
  syncRelation: syncDemographics,
  include: { association: "entries" }
});
