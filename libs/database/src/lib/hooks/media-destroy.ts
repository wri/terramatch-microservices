import { DatabaseModule } from "../database.module";
import { Media } from "../entities";
import { DestroyOptions } from "sequelize";

export const mediaDestroy = async (media: Media, options: DestroyOptions) => {
  const sendEvent = async () => {
    await DatabaseModule.emitMediaDeleted(media);
  };

  if (options?.transaction != null) {
    options.transaction.afterCommit(sendEvent);
  } else {
    sendEvent();
  }
};
