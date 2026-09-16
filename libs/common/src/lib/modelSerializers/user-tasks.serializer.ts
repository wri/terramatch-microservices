import { modelOrNotFound, ModelSerializer } from "./model-serializer";
import { Task, UserTask } from "@terramatch-microservices/database/entities";
import { buildDeletedResponse, buildJsonApi, DocumentBuilder, getDtoType } from "../util";
import { Includeable } from "sequelize";
import { UserTaskAssociation, UserTaskDto } from "../dto/user-task.dto";
import { groupBy } from "lodash";

const INCLUDE: Includeable[] = [
  { association: "organisation", attributes: ["uuid", "name"] },
  { association: "project", attributes: ["uuid", "name", "frameworkKey"] }
];

const addDto = async (document: DocumentBuilder, task: Task, associations?: UserTaskAssociation[]) => {
  if (associations == null) {
    associations = (
      await task.$get("userTasks", {
        include: [{ association: "user", attributes: ["uuid", "firstName", "lastName"] }]
      })
    ).map(userTask => new UserTaskAssociation(userTask));
  }
  return document.addData(task.uuid, new UserTaskDto(task, associations ?? []));
};

export const UserTasksSerializer: ModelSerializer<Task> = {
  async findById(id, options) {
    return modelOrNotFound(
      await Task.findByPk(id, { include: INCLUDE, paranoid: !(options?.includeDeleted ?? false) })
    );
  },

  async findByUuid(uuid, options) {
    return modelOrNotFound(
      await Task.findOne({ where: { uuid }, include: INCLUDE, paranoid: !(options?.includeDeleted ?? false) })
    );
  },

  async findForUser(userId) {
    return await Task.findAll({
      where: { "$userTasks.user_id$": userId },
      include: [
        ...INCLUDE,
        {
          association: "userTasks",
          required: true,
          attributes: []
        }
      ]
    });
  },

  createDocument() {
    return buildJsonApi<UserTaskDto>(UserTaskDto);
  },

  addDto,

  async addDtos(document, tasks) {
    const associations = groupBy(
      await UserTask.findAll({
        where: { taskId: tasks.map(({ id }) => id) },
        include: [{ association: "user", attributes: ["uuid", "firstName", "lastName"] }]
      }),
      "taskId"
    );

    for (const task of tasks) {
      await addDto(
        document,
        task,
        (associations[task.id] ?? []).map(userTask => new UserTaskAssociation(userTask))
      );
    }
    return document;
  },

  serializeDeletion(task) {
    return buildDeletedResponse(getDtoType(UserTaskDto), task.uuid);
  }
};
