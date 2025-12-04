import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { SitePolygon, PolygonUpdates, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Op, Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class SitePolygonVersioningService {
  private readonly logger = new Logger(SitePolygonVersioningService.name);

  async createVersion(
    basePolygon: SitePolygon,
    attributeChanges: Partial<SitePolygon>,
    newPolygonGeometryUuid: string | null,
    userId: number,
    changeReason: string,
    userFullName: string | null,
    transaction: Transaction
  ): Promise<SitePolygon> {
    const versionName = this.generateVersionName(attributeChanges.polyName ?? basePolygon.polyName, userFullName);

    const newVersionUuid = uuidv4();
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

    const newVersion = await SitePolygon.create(newVersionData as SitePolygon, { transaction });

    await this.deactivateOtherVersions(basePolygon.primaryUuid, newVersionUuid, transaction);

    await this.trackChange(
      basePolygon.primaryUuid,
      versionName,
      changeReason,
      userId,
      "update",
      undefined,
      undefined,
      transaction
    );

    this.logger.log(
      `Created new version ${newVersionUuid} from active base ${basePolygon.uuid} (group: ${basePolygon.primaryUuid})`
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

  async validateVersioningEligibility(sitePolygonUuid: string): Promise<SitePolygon> {
    const referencePolygon = await SitePolygon.findOne({
      where: { uuid: sitePolygonUuid }
    });

    if (referencePolygon == null) {
      throw new NotFoundException(`Site polygon not found: ${sitePolygonUuid}`);
    }

    if (referencePolygon.primaryUuid == null) {
      throw new BadRequestException(`Site polygon ${sitePolygonUuid} has no primaryUuid set. Cannot create version.`);
    }

    const activePolygon = await SitePolygon.findOne({
      where: {
        primaryUuid: referencePolygon.primaryUuid,
        isActive: true
      }
    });

    if (activePolygon == null) {
      throw new NotFoundException(
        `No active version found for polygon group ${referencePolygon.primaryUuid}. ` +
          `The reference polygon ${sitePolygonUuid} may have been deactivated.`
      );
    }

    return activePolygon;
  }
}
