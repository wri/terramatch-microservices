import { LinkedField } from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary } from "lodash";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { ResourceCollector } from "./index";
import { LoggerService } from "@nestjs/common";

export function fieldCollector(logger: LoggerService): ResourceCollector<LinkedField> {
  const polygonQuestions: Dictionary<string> = {};
  const propertyQuestions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      if (field.inputType === "mapInput" || field.property === "proj_boundary") {
        if (polygonQuestions[modelType] != null) {
          logger.warn(`Duplicate polygon field for model type ${modelType}`);
        }
        polygonQuestions[modelType] = questionUuid;
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
        answers[questionUuid] = polygon?.polygon?.polygon; // drill down to the geojson field
      }
    }
  };
}
