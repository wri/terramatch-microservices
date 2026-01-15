import { FactoryGirl } from "factory-girl-ts";
import { ProjectPitch, ProjectPolygon } from "../entities";
import { PolygonGeometryFactory } from "./polygon-geometry.factory";
import { ProjectPitchFactory } from "./project-pitch.factory";
import { UserFactory } from "./user.factory";

export const ProjectPolygonFactory = {
  forPitch: (pitch?: ProjectPitch) =>
    FactoryGirl.define(ProjectPolygon, async () => {
      const createdBy = UserFactory.associate("id");
      return {
        polyUuid: PolygonGeometryFactory.associate("uuid"),
        entityType: ProjectPitch.LARAVEL_TYPE,
        entityId: (pitch?.id as number) ?? ProjectPitchFactory.associate("id"),
        createdBy: createdBy.get("id"),
        lastModifiedBy: createdBy.get("id")
      };
    })
};
