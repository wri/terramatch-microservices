import { modelOrNotFound, ModelSerializer } from "./util";
import { SiteReport, Task, TreeSpecies } from "@terramatch-microservices/database/entities";
import { buildJsonApi, DocumentBuilder } from "../util";
import { Includeable } from "sequelize";
import { TaskFullDto } from "../dto/task.dto";

const INCLUDE: Includeable[] = [
  { association: "organisation", attributes: ["name"], required: true },
  // Project framework key is required for the policy (see task.policy.ts `frameworkKey` checks,
  // and the `get frameworkKey` method in task.entity.ts
  { association: "project", attributes: ["name", "frameworkKey"], required: true }
];

export const TasksSerializer: ModelSerializer<Task> = {
  async findById(id: number) {
    return modelOrNotFound(await Task.findByPk(id, { include: INCLUDE }));
  },

  async findByUuid(uuid: string) {
    return modelOrNotFound(await Task.findOne({ where: { uuid }, include: INCLUDE }));
  },

  createDocument() {
    return buildJsonApi<TaskFullDto>(TaskFullDto);
  },

  async addFullDto(document: DocumentBuilder, task: Task) {
    const treesPlantedCount =
      (await TreeSpecies.visible()
        .collection("tree-planted")
        .siteReports(SiteReport.approvedIdsForTaskSubquery(task.id))
        .sum("amount")) ?? 0;

    return document.addData(task.uuid, new TaskFullDto(task, { treesPlantedCount }));
  }
};
