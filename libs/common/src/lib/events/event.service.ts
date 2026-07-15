import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EntityStatusUpdate } from "./entity-status-update.event-processor";
import { StatusUpdateModel } from "@terramatch-microservices/database/types/util";
import { TMLogger } from "../util/tm-logger";
import { MediaService } from "../media/media.service";
import { Media, PolygonGeometry, User } from "@terramatch-microservices/database/entities";
import { POLYGON_PUSHED_VIA_API_EVENT, PolygonPushedViaApiParams } from "../analytics/polygon-pushed-via-api";
import { POLYGON_VERSION_CHANGED_EVENT, PolygonVersionChangedParams } from "../analytics/polygon-version-changed";

/**
 * A service to handle general events that are emitted in the common or database libraries, and
 * should be handled in all of our various microservice apps.
 */
@Injectable()
export class EventService {
  private readonly logger = new TMLogger(EventService.name);

  constructor(
    @InjectQueue("email") readonly emailQueue: Queue,
    @InjectQueue("analytics") readonly analyticsQueue: Queue,
    @InjectQueue("entities") readonly entitiesQueue: Queue,
    @InjectQueue("greenhouse") readonly greenhouseQueue: Queue,
    readonly mediaService: MediaService
  ) {}

  @OnEvent("database.statusUpdated")
  async handleStatusUpdated(model: StatusUpdateModel) {
    await new EntityStatusUpdate(this, model).handle();
  }

  @OnEvent("database.mediaDeleted")
  async handleMediaDeleted(media: Media) {
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
    await this.greenhouseQueue.add("mediaDeleted", media);
  }

  @OnEvent("database.polygonUpdated")
  async handlePolygonUpdated(polygon: PolygonGeometry) {
    await this.greenhouseQueue.add("polygonUpdated", polygon);
  }

  async sendStatusUpdateAnalytics(modelUuid: string, modelLaravelType: string, status: string) {
    this.logger.log(`Sending status update analytics for ${modelUuid}, ${modelLaravelType} to queue.`);
    await this.analyticsQueue.add("modelStatusUpdate", {
      uuid: modelUuid,
      params: { modelType: modelLaravelType, status }
    });
  }

  async sendPolygonPushedViaApiAnalytics(partnerId: string, params: PolygonPushedViaApiParams) {
    this.logger.debug(
      `Sending polygon pushed via API analytics for polygon ${params.polygon_id} (partner: ${partnerId}) to queue.`
    );
    await this.analyticsQueue.add(POLYGON_PUSHED_VIA_API_EVENT, {
      uuid: partnerId,
      params
    });
  }

  async sendPolygonVersionChangedAnalytics(primaryUuid: string, params: PolygonVersionChangedParams) {
    this.logger.debug(
      `Sending polygon version changed analytics for polygon group ${params.polygon_id} (${params.change_source}) to queue.`
    );
    await this.analyticsQueue.add(POLYGON_VERSION_CHANGED_EVENT, {
      uuid: primaryUuid,
      params
    });
  }
}
