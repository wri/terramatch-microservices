import { Injectable } from "@nestjs/common";
import { SitePolygon, User } from "@terramatch-microservices/database/entities";
import { PolygonStatus } from "@terramatch-microservices/database/constants";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { isAdminSessionFromRoles } from "@terramatch-microservices/common/analytics/polygon-version-changed";
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { SitePolygonStatusUpdate } from "./dto/site-polygon-status-update.dto";
import { SitePolygonBulkAttributeChangesDto } from "./dto/site-polygon-bulk-attribute-update.dto";

@Injectable()
export class SitePolygonBulkUpdateService {
  private readonly logger = new TMLogger(SitePolygonBulkUpdateService.name);

  constructor(
    private readonly sitePolygonsService: SitePolygonsService,
    private readonly sitePolygonCreationService: SitePolygonCreationService
  ) {}

  async updateStatus(
    status: PolygonStatus,
    data: SitePolygonStatusUpdate[],
    comment: string | null | undefined,
    userId: number
  ) {
    const user = await User.findByPk(userId, { attributes: ["id", "firstName", "lastName", "emailAddress"] });
    return await this.sitePolygonsService.updateBulkStatus(status, data, comment, user);
  }

  async updateAttributes(uuids: string[], attributeChanges: SitePolygonBulkAttributeChangesDto, userId: number) {
    const user = await User.findByPk(userId, { attributes: ["firstName", "lastName", "roles"] });
    const source = user?.getSourceFromRoles() ?? "terramatch";

    const newVersions = await SitePolygon.sql.transaction(async transaction =>
      this.sitePolygonCreationService.bulkUpdateSitePolygonAttributes(
        uuids,
        attributeChanges,
        userId,
        user?.fullName ?? null,
        source,
        transaction,
        isAdminSessionFromRoles(user?.roles),
        user?.canReviewPolygons ?? false
      )
    );

    if (source === "greenhouse") {
      const polygonUuids = newVersions
        .map(sp => sp.polygonUuid)
        .filter((uuid): uuid is string => uuid != null && uuid !== "");
      if (polygonUuids.length > 0) {
        this.sitePolygonsService
          .enqueuePolygonValidation(polygonUuids, userId, {
            siteUuid: newVersions[0]?.siteUuid ?? undefined,
            triggerType: "gh_push"
          })
          .catch(err =>
            this.logger.error("Failed to enqueue automated polygon validation after bulk attribute update", err)
          );
      }
    }

    this.logger.log(`Bulk attribute update created ${newVersions.length} version(s) by user ${userId}`);

    return newVersions;
  }
}
