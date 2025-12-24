import { FactoryGirl } from "factory-girl-ts";
import { ProjectPolygon } from "../entities";
import { UserFactory } from "./user.factory";
import { PolygonGeometryFactory } from "./polygon-geometry.factory";
import { ProjectPitchFactory } from "./project-pitch.factory";

export const ProjectPolygonFactory = FactoryGirl.define(ProjectPolygon, async () => {
  const createdBy = UserFactory.associate("id");
  return {
    polyUuid: PolygonGeometryFactory.associate("uuid"),
    entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
    entityId: ProjectPitchFactory.associate("id"),
    createdBy: createdBy.get("id"),
    lastModifiedBy: createdBy.get("id")
  };
});
