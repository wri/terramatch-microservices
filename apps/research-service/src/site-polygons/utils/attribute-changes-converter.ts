import { SitePolygon } from "@terramatch-microservices/database/entities";
import { AttributeChangesDto } from "../dto/create-site-polygon-request.dto";

export function convertPropertiesToAttributeChanges(properties: Partial<SitePolygon>): AttributeChangesDto {
  const attributeChanges: AttributeChangesDto = {};

  if (properties.polyName != null) {
    attributeChanges.polyName = properties.polyName;
    attributeChanges.poly_name = properties.polyName;
  }

  if (properties.plantStart != null) {
    const plantStartString =
      properties.plantStart instanceof Date ? properties.plantStart.toISOString() : String(properties.plantStart);
    attributeChanges.plantStart = plantStartString;
    attributeChanges.plantstart = plantStartString;
  }

  if (properties.practice != null && properties.practice.length > 0) {
    attributeChanges.practice = properties.practice;
  }

  if (properties.targetSys != null) {
    attributeChanges.targetSys = properties.targetSys;
    attributeChanges.target_sys = properties.targetSys;
  }

  if (properties.distr != null && properties.distr.length > 0) {
    attributeChanges.distr = properties.distr;
  }

  if (properties.numTrees != null) {
    attributeChanges.numTrees = properties.numTrees;
    attributeChanges.num_trees = properties.numTrees;
  }

  return attributeChanges;
}
