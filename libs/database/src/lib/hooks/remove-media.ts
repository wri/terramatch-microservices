import { MediaOwnerModel } from "../constants/media-owners";
import { Media } from "../entities";

export const removeMedia = async (instance: MediaOwnerModel) => {
  await Media.for(instance).destroy();
};
