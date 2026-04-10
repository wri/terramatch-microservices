import { DatabaseModule } from "../database.module";
import { Media, User } from "../entities";
import { DestroyOptions } from "sequelize";

export const mediaDestroy = async (media: Media, options: DestroyOptions) => {
  const sendEvent = async () => {
    let createdBy = media.getDataValue("createdBy");
    if (createdBy === undefined) {
      const mediaWithProperty = await Media.findOne({
        where: { uuid: media.uuid },
        attributes: ["createdBy"]
      });
      createdBy = mediaWithProperty?.getDataValue("createdBy") ?? null;
    }
    if (createdBy === null) {
      return;
    }
    const user = await User.findByPk(createdBy, { include: [{ association: "roles" }] });
    if (!user?.roles?.map(role => role.name).includes("greenhouse-service-account")) {
      return;
    }
    await DatabaseModule.emitMediaDeleted(media);
  };

  if (options?.transaction) {
    options.transaction.afterCommit(sendEvent);
  } else {
    sendEvent();
  }
};
