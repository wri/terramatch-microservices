import { ModelSerializer } from "@terramatch-microservices/common/modelSerializers/model-serializer";
import { NotificationsSerializer } from "@terramatch-microservices/common/modelSerializers/notifications.serializer";
import { UserTasksSerializer } from "@terramatch-microservices/common/modelSerializers/user-tasks.serializer";
import { UserDataModel } from "@terramatch-microservices/database/types/user-model";

export const USER_DATA_SERIALIZERS: Record<UserDataModel, ModelSerializer> = {
  notifications: NotificationsSerializer,
  tasks: UserTasksSerializer
};
