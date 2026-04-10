import { DatabaseModule } from "../database.module";
import { PolygonGeometry } from "../entities";
import { InstanceUpdateOptions } from "sequelize";

export const polygonUpdate = async (polygon: PolygonGeometry, options: InstanceUpdateOptions) => {
  const sendEvent = async () => {
    await DatabaseModule.emitPolygonUpdated(polygon);
  };
  if (options?.transaction != null) {
    options.transaction.afterCommit(sendEvent);
  } else {
    sendEvent();
  }
};
