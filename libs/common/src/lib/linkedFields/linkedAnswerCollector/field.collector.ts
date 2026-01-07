import {
  isPropertyField,
  LinkedField,
  VirtualLinkedFieldProps
} from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary, difference, isEmpty, isInteger, isString, uniq } from "lodash";
import { FormModel, FormModelType } from "@terramatch-microservices/database/constants/entities";
import {
  Demographic,
  DemographicEntry,
  FormQuestion,
  ProjectPolygon
} from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { FieldResourceCollector } from "./index";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { mapLaravelTypes } from "./utils";
import { WhereOptions } from "sequelize";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";

export function fieldCollector(logger: LoggerService): FieldResourceCollector {
  const propertyQuestions: Dictionary<string> = {};
  const virtualQuestions: Dictionary<{ props: VirtualLinkedFieldProps; modelType: FormModelType }> = {};

  return {
    addField(field, modelType, questionUuid) {
      if (isPropertyField(field)) {
        propertyQuestions[questionUuid] = `${modelType}:${field.property}`;
      } else {
        virtualQuestions[questionUuid] = { props: field.virtual, modelType };
      }
    },

    async collect(answers, models) {
      const laravelTypes = mapLaravelTypes(models);

      for (const [questionUuid, key] of Object.entries(propertyQuestions)) {
        const [modelType, property] = key.split(":") as [FormModelType, string];
        if (models[modelType] == null) logger.error(`Model for type not found: ${modelType}`);
        else answers[questionUuid] = models[modelType][property];
      }

      // Pull all demographics for affected model types in one query. The entries are not being
      // pulled here in order to limit row count in the query. Not all field collections will
      // need entries, and usually when entries are required (for aggregate demographics), the
      // set of entries needed is constrained and may be pulled sequentially.
      const virtualQuestionModels = uniq(Object.values(virtualQuestions).map(({ modelType }) => modelType))
        .map(type => models[type])
        .filter(isNotNull);
      const demographics =
        virtualQuestionModels.length === 0 ? [] : await Demographic.for(virtualQuestionModels).findAll();

      for (const [questionUuid, { props, modelType }] of Object.entries(virtualQuestions)) {
        if (props.type == "demographicsAggregate") {
          // Find the first visible demographic that matches our config
          const demographic = demographics.find(({ hidden, demographicalType, demographicalId, type, collection }) => {
            if (hidden) return false;
            if (demographicalType !== laravelTypes[modelType] || demographicalId !== models[modelType]?.id)
              return false;
            if (type !== props.demographicsType) return false;
            return props.collection === collection;
          });

          answers[questionUuid] =
            demographic == null ? 0 : (await DemographicEntry.demographic(demographic.id).gender().sum("amount")) ?? 0;
        } else if (props.type == "demographicsDescription") {
          // Pull the description from the first matching demographic that has a non-null description.
          // For this one we ignore the "visible" flag.
          answers[questionUuid] = demographics.find(
            ({ demographicalType, demographicalId, type, collection, description }) => {
              if (description == null || collection == null) return false;
              if (demographicalType !== laravelTypes[modelType] || demographicalId !== models[modelType]?.id)
                return false;
              if (type !== props.demographicsType) return false;
              return props.collections.includes(collection);
            }
          )?.description;
        } else if (props.type === "projectBoundary") {
          const model = models[modelType];
          if (model == null) {
            logger.error(`Model for type not found: ${modelType}`);
            continue;
          }

          const polygon = await ProjectPolygon.findOne({
            where: { entityType: laravelType(model), entityId: model.id },
            order: [["createdAt", "DESC"]],
            attributes: ["polyUuid"]
          });
          if (polygon?.polyUuid != null) answers[questionUuid] = { polyUuid: polygon?.polyUuid };
        } else {
          throw new InternalServerErrorException(
            `Unrecognized virtual props type: ${(props as VirtualLinkedFieldProps).type}`
          );
        }
      }
    },

    async syncField(model: FormModel, question: FormQuestion, field: LinkedField, answers: Dictionary<unknown>) {
      const answer = answers[question.uuid];
      if (isPropertyField(field)) {
        model[field.property] = answer;
        return;
      }

      const { virtual } = field;
      if (virtual.type === "demographicsAggregate") {
        const value = answer == null ? null : Number(answer);
        if (value != null && (!isInteger(value) || value < 0)) {
          throw new BadRequestException(
            `Invalid demographics aggregate value: [${question.linkedFieldKey}, ${answer}]`
          );
        }

        let demographic = await Demographic.for(model)
          .type(virtual.demographicsType)
          .collection(virtual.collection)
          .findOne();
        if (value == null) {
          // We only get null as a value when the entity is being approved and the field was hidden.
          if (demographic != null) {
            await DemographicEntry.destroy({ where: { demographicId: demographic.id } });
            await demographic.destroy();
          }
          return;
        }

        if (demographic == null) {
          demographic = await Demographic.create({
            demographicalType: laravelType(model),
            demographicalId: model.id,
            type: virtual.demographicsType,
            collection: virtual.collection
          });

          await DemographicEntry.bulkCreate([
            { demographicId: demographic.id, type: "gender", subtype: "unknown", amount: value },
            { demographicId: demographic.id, type: "age", subtype: "unknown", amount: value }
          ]);
        } else {
          // make sure it hasn't been used for a typical demographics entry, as in that case we
          // don't want to handle trying to balance with this single integer value.
          const entries = await DemographicEntry.demographic(demographic.id).findAll();
          if (entries.length !== 2 || entries.find(({ subtype }) => subtype !== "unknown") != null) {
            throw new BadRequestException(
              `Illegal attempt to update complicated demographics through aggregate accessor. [${question.linkedFieldKey}]`
            );
          }

          // Make sure this demographic isn't hidden
          if (demographic.hidden) await demographic.update({ hidden: false });

          await DemographicEntry.update({ amount: value }, { where: { id: entries.map(({ id }) => id) } });
        }
      } else if (virtual.type === "demographicsDescription") {
        if (answer != null && !isString(answer)) {
          throw new BadRequestException(`Invalid demographics description: [${question.linkedFieldKey}, ${answer}]`);
        }

        const demographicWhere: WhereOptions<Demographic> = {
          demographicalType: laravelType(model),
          demographicalId: model.id,
          type: virtual.demographicsType,
          collection: virtual.collections
        };

        // If we're setting a non-empty value, make sure that each collection / type combination exists
        if (!isEmpty(answer)) {
          const collections = (await Demographic.findAll({ where: demographicWhere, attributes: ["collection"] }))
            .map(({ collection }) => collection)
            .filter(isNotNull);
          const missing = difference(virtual.collections, collections);
          if (missing.length > 0) {
            await Demographic.bulkCreate(
              missing.map(collection => ({
                demographicalType: laravelType(model),
                demographicalId: model.id as number,
                type: virtual.demographicsType,
                collection
              }))
            );
          }
        }

        await Demographic.update({ description: answer }, { where: demographicWhere });
      } else if (virtual.type === "projectBoundary") {
        // NOOP, the data saving happened in the FE.
      } else {
        throw new InternalServerErrorException(
          `Unrecognized virtual props type: ${(field.virtual as VirtualLinkedFieldProps).type}`
        );
      }
    }
  };
}
