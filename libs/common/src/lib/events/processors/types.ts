import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { MediaService } from "../../media/media.service";

export type EntityApprovalProcessor = {
  processEntityApproval(entity: EntityModel, mediaService: MediaService): Promise<void>;
};
