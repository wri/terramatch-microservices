import { modelOrNotFound, ModelSerializer } from "./model-serializer";
import { Notification } from "@terramatch-microservices/database/entities";
import { buildDeletedResponse, buildJsonApi, DocumentBuilder, getDtoType } from "../util";
import { Includeable } from "sequelize";
import { NotificationDto } from "../dto/notification.dto";

const INCLUDE: Includeable[] = [{ association: "project", attributes: ["uuid", "name"] }];

const addDto = async (document: DocumentBuilder, notification: Notification) =>
  document.addData(notification.uuid, new NotificationDto(notification));

export const NotificationsSerializer: ModelSerializer<Notification> = {
  async findById(id) {
    return modelOrNotFound(await Notification.findByPk(id, { include: INCLUDE }));
  },

  async findByUuid(uuid) {
    return modelOrNotFound(await Notification.findOne({ where: { uuid }, include: INCLUDE }));
  },

  async findForUser(userId) {
    return await Notification.findAll({ where: { userId }, include: INCLUDE });
  },

  createDocument() {
    return buildJsonApi<NotificationDto>(NotificationDto);
  },

  addDto,

  async addDtos(document, notifications) {
    for (const notification of notifications) {
      await addDto(document, notification);
    }
    return document;
  },

  serializeDeletion(uuid) {
    return buildDeletedResponse(getDtoType(NotificationDto), uuid);
  }
};
