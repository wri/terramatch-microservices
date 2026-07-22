import { SitePolygon } from "@terramatch-microservices/database/entities";
import { AttributeChangesDto } from "../dto/create-site-polygon-request.dto";

export function convertPropertiesToAttributeChanges(properties: Partial<SitePolygon>): AttributeChangesDto {
  const attributeChanges: AttributeChangesDto = {};

  if (properties.polyName != null) {
    attributeChanges.polyName = properties.polyName;
  }

  if (properties.plantStart != null) {
    attributeChanges.plantStart =
      properties.plantStart instanceof Date ? properties.plantStart.toISOString() : String(properties.plantStart);
  }

  if (properties.practice != null && properties.practice.length > 0) {
    attributeChanges.practice = properties.practice;
  }

  if (properties.targetSys != null) {
    attributeChanges.targetSys = properties.targetSys;
  }

  if (properties.distr != null && properties.distr.length > 0) {
    attributeChanges.distr = properties.distr;
  }

  if (properties.submissionCycle != null) {
    attributeChanges.submissionCycle = properties.submissionCycle;
  }

  if (properties.numTrees != null) {
    attributeChanges.numTrees = properties.numTrees;
  }

  return attributeChanges;
}
