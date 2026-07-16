import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { SitePolygon, PolygonUpdates, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Op, Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { EventService } from "@terramatch-microservices/common/events/event.service";
import { buildPolygonVersionChangedParams } from "@terramatch-microservices/common/analytics/polygon-version-changed";

export interface VersionCreateEntry {
  basePolygon: SitePolygon;
  attributeChanges: Partial<SitePolygon>;
  newPolygonGeometryUuid: string | null;
  userId: number;
  changeReason: string;
  userFullName: string | null;
  source?: string;
  isAdminSession?: boolean;
}

@Injectable()
export class SitePolygonVersioningService {
  private readonly logger = new Logger(SitePolygonVersioningService.name);

  constructor(private readonly eventService: EventService) {}

  buildVersionData(
    basePolygon: SitePolygon,
    attributeChanges: Partial<SitePolygon>,
    newPolygonGeometryUuid: string | null,
    userId: number,
    userFullName: string | null,
    newVersionUuid: string
  ): Partial<SitePolygon> {
    const versionName = this.generateVersionName(attributeChanges.polyName ?? basePolygon.polyName, userFullName);

    const newVersionData: Partial<SitePolygon> = {
      ...basePolygon.get({ plain: true }),
      ...attributeChanges,
      uuid: newVersionUuid,
      primaryUuid: basePolygon.primaryUuid,
      versionName,
      isActive: true,
      createdBy: userId,
      updatedAt: new Date(),
      createdAt: new Date()
    };

    if (newPolygonGeometryUuid != null) {
      newVersionData.polygonUuid = newPolygonGeometryUuid;
    }

    const versionDataToCreate = newVersionData as Record<string, unknown>;
    delete versionDataToCreate.id;
    delete versionDataToCreate.deletedAt;

    return versionDataToCreate as Partial<SitePolygon>;
  }

  async createVersions(entries: VersionCreateEntry[], transaction: Transaction): Promise<SitePolygon[]> {
    if (entries.length === 0) {
      return [];
    }

    const versionRecords: Partial<SitePolygon>[] = [];
    const polygonUpdateRecords: Partial<PolygonUpdates>[] = [];
    const lastNewVersionPerPrimary = new Map<string, string>();

    for (const entry of entries) {
      const newVersionUuid = uuidv4();
      const primaryUuid = entry.basePolygon.primaryUuid;
      if (primaryUuid == null) {
        throw new BadRequestException(
          `Site polygon ${entry.basePolygon.uuid} has no primaryUuid set. Cannot create version.`
        );
      }

      lastNewVersionPerPrimary.set(primaryUuid, newVersionUuid);

      const versionData = this.buildVersionData(
        entry.basePolygon,
        entry.attributeChanges,
        entry.newPolygonGeometryUuid,
        entry.userId,
        entry.userFullName,
        newVersionUuid
      );
      versionRecords.push(versionData);

      polygonUpdateRecords.push({
        sitePolygonUuid: primaryUuid,
        versionName: versionData.versionName ?? "Unknown",
        change: entry.changeReason,
        updatedById: entry.userId,
        comment: null,
        type: "update",
        oldStatus: null,
        newStatus: null
      });
    }

    const newVersions = await SitePolygon.bulkCreate(versionRecords as SitePolygon[], { transaction });

    const keepActiveUuids = [...lastNewVersionPerPrimary.values()];
    const primaryUuids = [...lastNewVersionPerPrimary.keys()];

    await SitePolygon.update(
      { isActive: false },
      {
        where: {
          primaryUuid: { [Op.in]: primaryUuids },
          uuid: { [Op.notIn]: keepActiveUuids }
        },
        transaction
      }
    );

    await PolygonUpdates.bulkCreate(polygonUpdateRecords as PolygonUpdates[], { transaction });

    if (entries.length === 1) {
      const entry = entries[0];
      this.logger.log(
        `Created new version ${newVersions[0].uuid} from active base ${entry.basePolygon.uuid} (group: ${entry.basePolygon.primaryUuid})`
      );
    } else {
      this.logger.log(`Created ${newVersions.length} new site polygon version(s)`);
    }

    this.queuePolygonVersionChangedAnalytics(entries, newVersions, transaction);

    return newVersions;
  }

  private queuePolygonVersionChangedAnalytics(
    entries: VersionCreateEntry[],
    newVersions: SitePolygon[],
    transaction: Transaction
  ): void {
    const analyticsParams = entries
      .map((entry, index) =>
        buildPolygonVersionChangedParams(entry.basePolygon, newVersions[index], {
          changeReason: entry.changeReason,
          newPolygonGeometryUuid: entry.newPolygonGeometryUuid,
          source: entry.source,
          isAdminSession: entry.isAdminSession
        })
      )
      .filter((params): params is NonNullable<typeof params> => params != null);

    if (analyticsParams.length === 0) {
      return;
    }

    transaction.afterCommit(() => {
      void Promise.all(
        analyticsParams.map(params => this.eventService.sendPolygonVersionChangedAnalytics(params.polygon_id, params))
      );
    });
  }

  async createVersion(
    basePolygon: SitePolygon,
    attributeChanges: Partial<SitePolygon>,
    newPolygonGeometryUuid: string | null,
    userId: number,
    changeReason: string,
    userFullName: string | null,
    transaction: Transaction
  ): Promise<SitePolygon> {
    const [newVersion] = await this.createVersions(
      [
        {
          basePolygon,
          attributeChanges,
          newPolygonGeometryUuid,
          userId,
          changeReason,
          userFullName
        }
      ],
      transaction
    );

    return newVersion;
  }

  async trackChange(
    primaryUuid: string,
    versionName: string,
    changeDescription: string,
    userId: number,
    type: "update" | "status",
    oldStatus?: string,
    newStatus?: string,
    transaction?: Transaction
  ): Promise<void> {
    await PolygonUpdates.create(
      {
        sitePolygonUuid: primaryUuid,
        versionName,
        change: changeDescription,
        updatedById: userId,
        comment: null,
        type,
        oldStatus: oldStatus ?? null,
        newStatus: newStatus ?? null
      } as PolygonUpdates,
      { transaction }
    );
  }

  generateVersionName(polyName: string | null, userFullName: string | null): string {
    const now = new Date();

    const date = `${now.getUTCDate()}_${now.toLocaleDateString("en-US", {
      month: "long",
      timeZone: "UTC"
    })}_${now.getUTCFullYear()}`;

    const time = `${String(now.getUTCHours()).padStart(2, "0")}_${String(now.getUTCMinutes()).padStart(
      2,
      "0"
    )}_${String(now.getUTCSeconds()).padStart(2, "0")}`;

    const name = polyName ?? "Unnamed";

    const user = userFullName != null && userFullName.length > 0 ? `_${userFullName.replace(/\s+/g, "_")}` : "";

    return `${name}_${date}_${time}${user}`;
  }

  async deactivateOtherVersions(primaryUuid: string, exceptUuid: string, transaction: Transaction): Promise<void> {
    await SitePolygon.update(
      { isActive: false },
      {
        where: {
          primaryUuid,
          uuid: { [Op.ne]: exceptUuid }
        },
        transaction
      }
    );
  }

  async getVersionHistory(primaryUuid: string): Promise<SitePolygon[]> {
    return SitePolygon.findAll({
      where: { primaryUuid },
      order: [["createdAt", "DESC"]],
      include: [{ model: PolygonGeometry, attributes: ["uuid"] }]
    });
  }

  async activateVersion(targetUuid: string, userId: number, transaction: Transaction): Promise<SitePolygon> {
    const targetVersion = await SitePolygon.findOne({
      where: { uuid: targetUuid },
      transaction
    });

    if (targetVersion == null) {
      throw new NotFoundException(`Site polygon version not found: ${targetUuid}`);
    }

    await this.deactivateOtherVersions(targetVersion.primaryUuid, targetUuid, transaction);

    targetVersion.isActive = true;
    await targetVersion.save({ transaction });

    await this.trackChange(
      targetVersion.primaryUuid,
      targetVersion.versionName ?? "Unknown",
      `Version activated by user ${userId}`,
      userId,
      "update",
      undefined,
      undefined,
      transaction
    );

    return targetVersion;
  }

  async getChangeHistory(primaryUuid: string): Promise<PolygonUpdates[]> {
    return PolygonUpdates.findAll({
      where: { sitePolygonUuid: primaryUuid },
      order: [["createdAt", "DESC"]]
    });
  }

  buildChangeDescription(oldValues: Partial<SitePolygon>, newValues: Partial<SitePolygon>): string {
    const changes: string[] = [];

    for (const [key, newValue] of Object.entries(newValues)) {
      const oldValue = oldValues[key as keyof SitePolygon];
      if (oldValue !== newValue) {
        changes.push(`${key} => from ${oldValue ?? "null"} to ${newValue ?? "null"}`);
      }
    }

    const changesDescription = changes.join(", ");
    return changesDescription.length > 0 ? changesDescription : "No attribute changes";
  }

  async validateVersioningEligibility(sitePolygonUuid: string, transaction?: Transaction): Promise<SitePolygon> {
    const activeByRequestUuid = await this.validateBulkVersioningEligibility([sitePolygonUuid], transaction);
    const activePolygon = activeByRequestUuid.get(sitePolygonUuid);
    if (activePolygon == null) {
      throw new NotFoundException(`Site polygon not found: ${sitePolygonUuid}`);
    }

    return activePolygon;
  }

  async validateBulkVersioningEligibility(
    sitePolygonUuids: string[],
    transaction?: Transaction
  ): Promise<Map<string, SitePolygon>> {
    const referencePolygons = await SitePolygon.findAll({
      where: { uuid: { [Op.in]: sitePolygonUuids } },
      transaction
    });

    const referenceByUuid = new Map(referencePolygons.map(polygon => [polygon.uuid, polygon]));

    for (const sitePolygonUuid of sitePolygonUuids) {
      const referencePolygon = referenceByUuid.get(sitePolygonUuid);

      if (referencePolygon == null) {
        throw new NotFoundException(`Site polygon not found: ${sitePolygonUuid}`);
      }

      if (referencePolygon.primaryUuid == null) {
        throw new BadRequestException(`Site polygon ${sitePolygonUuid} has no primaryUuid set. Cannot create version.`);
      }
    }

    const primaryUuids = [...new Set(referencePolygons.map(polygon => polygon.primaryUuid as string))];

    const activePolygons = await SitePolygon.findAll({
      where: {
        primaryUuid: { [Op.in]: primaryUuids },
        isActive: true
      },
      transaction
    });

    const activeByPrimaryUuid = new Map(activePolygons.map(polygon => [polygon.primaryUuid, polygon]));
    const activeByRequestUuid = new Map<string, SitePolygon>();

    for (const sitePolygonUuid of sitePolygonUuids) {
      const referencePolygon = referenceByUuid.get(sitePolygonUuid);
      if (referencePolygon == null) {
        throw new NotFoundException(`Site polygon not found: ${sitePolygonUuid}`);
      }

      const primaryUuid = referencePolygon.primaryUuid;
      if (primaryUuid == null) {
        throw new BadRequestException(`Site polygon ${sitePolygonUuid} has no primaryUuid set. Cannot create version.`);
      }

      const activePolygon = activeByPrimaryUuid.get(primaryUuid);

      if (activePolygon == null) {
        throw new NotFoundException(
          `No active version found for polygon group ${primaryUuid}. ` +
            `The reference polygon ${sitePolygonUuid} may have been deactivated.`
        );
      }

      activeByRequestUuid.set(sitePolygonUuid, activePolygon);
    }

    return activeByRequestUuid;
  }
}
