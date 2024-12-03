import { Project } from "@terramatch-microservices/database/entities";
import { AirtableEntity } from "./airtable-entity";

export const ProjectEntity: AirtableEntity<Project> = {
  TABLE_NAME: "Projects",
  UUID_COLUMN: "TM Project ID",

  findOne: async (uuid: string) => await Project.findOne({ where: { uuid } }),

  mapDbEntity: async (project: Project) => ({
    "Project Name": project.name
  })
};
