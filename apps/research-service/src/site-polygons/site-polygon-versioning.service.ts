import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { SitePolygon, PolygonUpdates, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Op, Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";

/**
 * Service responsible for all site polygon versioning operations.
 *
 * Key Concepts:
 * - primaryUuid: Groups all versions of the same polygon together
 * - isActive: Only ONE version per primaryUuid can be active at a time
 * - PolygonUpdates: Audit trail table tracking all changes
 *
 * Version Creation Flow:
 * 1. Find base polygon
 * 2. Create new PolygonGeometry (if geometry changed)
 * 3. Create new SitePolygon with new UUID, same primaryUuid
 * 4. Set new version as active
 * 5. Deactivate all other versions in the group
 * 6. Track change in PolygonUpdates table
 */
@Injectable()
export class SitePolygonVersioningService {
  private readonly logger = new Logger(SitePolygonVersioningService.name);

  /**
   * Creates a new version of an existing site polygon.
   *
   * Process:
   * 1. Loads base polygon and validates it exists
   * 2. Creates new polygon record with:
   *    - New UUID (unique identifier for this version)
   *    - Same primaryUuid (links to version group)
   *    - Updated attributes/geometry
   *    - New version name
   *    - isActive = true
   * 3. Deactivates all other versions
   * 4. Tracks change in polygon_updates table
   *
   * @param baseSitePolygonUuid - UUID of the polygon to create version from
   * @param attributeChanges - Partial attributes to update (e.g., polyName, numTrees)
   * @param newPolygonGeometryUuid - UUID of new PolygonGeometry if geometry changed
   * @param userId - User creating the version
   * @param changeReason - Description of why version was created
   * @param userFullName - Full name for version name generation
   * @param transaction - Database transaction
   * @returns Newly created SitePolygon version
   */
  async createVersion(
    baseSitePolygonUuid: string,
    attributeChanges: Partial<SitePolygon>,
    newPolygonGeometryUuid: string | null,
    userId: number,
    changeReason: string,
    userFullName: string | null,
    transaction: Transaction
  ): Promise<SitePolygon> {
    // 1. Load base polygon
    const basePolygon = await SitePolygon.findOne({
      where: { uuid: baseSitePolygonUuid },
      transaction
    });

    if (basePolygon == null) {
      throw new NotFoundException(`Site polygon not found: ${baseSitePolygonUuid}`);
    }

    // 2. Generate version name
    const versionName = this.generateVersionName(attributeChanges.polyName ?? basePolygon.polyName, userFullName);

    // 3. Prepare new version data
    const newVersionUuid = uuidv4();
    const newVersionData: Partial<SitePolygon> = {
      ...basePolygon.get({ plain: true }),
      ...attributeChanges,
      uuid: newVersionUuid,
      primaryUuid: basePolygon.primaryUuid, // Keep same version group
      versionName,
      isActive: true,
      createdBy: userId,
      updatedAt: new Date(),
      createdAt: new Date()
    };

    // Update geometry reference if provided
    if (newPolygonGeometryUuid != null) {
      newVersionData.polygonUuid = newPolygonGeometryUuid;
    }

    // Remove fields that shouldn't be copied
    const versionDataToCreate = newVersionData as Record<string, unknown>;
    delete versionDataToCreate.id;
    delete versionDataToCreate.deletedAt;

    // 4. Create new version
    const newVersion = await SitePolygon.create(newVersionData as SitePolygon, { transaction });

    // 5. Deactivate all other versions
    await this.deactivateOtherVersions(basePolygon.primaryUuid, newVersionUuid, transaction);

    // 6. Track change in polygon_updates
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
      `Created new version ${newVersionUuid} from base ${baseSitePolygonUuid} (group: ${basePolygon.primaryUuid})`
    );

    return newVersion;
  }

  /**
   * Tracks a change in the polygon_updates table.
   *
   * This creates an audit trail entry for any modification to a polygon.
   * The entry is linked to the primaryUuid so all versions share the same history.
   *
   * @param primaryUuid - The primaryUuid of the polygon (version group)
   * @param versionName - Name of the version where change occurred
   * @param changeDescription - Human-readable description of the change
   * @param userId - User who made the change
   * @param type - Type of change: 'update' for attribute/geometry changes, 'status' for status changes
   * @param oldStatus - Previous status (for status changes)
   * @param newStatus - New status (for status changes)
   * @param transaction - Database transaction
   */
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
        sitePolygonUuid: primaryUuid, // Note: references primaryUuid, not uuid!
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

    this.logger.debug(`Tracked ${type} change for polygon group ${primaryUuid}: ${changeDescription}`);
  }

  /**
   * Generates a version name following V2 format.
   *
   * Format: {poly_name}_{date}_{time}_{username}
   * Example: "North_Field_10_November_2025_14_30_45_John_Doe"
   *
   * This matches the V2 PHP implementation exactly.
   *
   * @param polyName - Name of the polygon (or 'Unnamed' if null)
   * @param userFullName - Full name of user (appended if provided)
   * @returns Formatted version name
   */
  generateVersionName(polyName: string | null, userFullName: string | null): string {
    const now = new Date();

    // Format date: "10_November_2025"
    const date = `${now.getDate()}_${now.toLocaleDateString("en-US", {
      month: "long"
    })}_${now.getFullYear()}`;

    // Format time: "14_30_45"
    const time = `${String(now.getHours()).padStart(2, "0")}_${String(now.getMinutes()).padStart(2, "0")}_${String(
      now.getSeconds()
    ).padStart(2, "0")}`;

    // Use poly name or default
    const name = polyName ?? "Unnamed";

    // Append user name if provided
    const user = userFullName != null && userFullName.length > 0 ? `_${userFullName}` : "";

    return `${name}_${date}_${time}${user}`;
  }

  /**
   * Deactivates all versions in a group except the specified one.
   *
   * Ensures only ONE version per primaryUuid has isActive=true.
   * This is a critical constraint for the versioning system.
   *
   * @param primaryUuid - The version group identifier
   * @param exceptUuid - UUID of version to keep active
   * @param transaction - Database transaction
   */
  async deactivateOtherVersions(primaryUuid: string, exceptUuid: string, transaction: Transaction): Promise<void> {
    const updatedCount = await SitePolygon.update(
      { isActive: false },
      {
        where: {
          primaryUuid,
          uuid: { [Op.ne]: exceptUuid }
        },
        transaction
      }
    );

    this.logger.debug(`Deactivated ${updatedCount[0]} versions in group ${primaryUuid} (keeping ${exceptUuid} active)`);
  }

  /**
   * Gets all versions of a polygon ordered by creation date (newest first).
   *
   * @param primaryUuid - The version group identifier
   * @returns Array of all versions in the group
   */
  async getVersionHistory(primaryUuid: string): Promise<SitePolygon[]> {
    return SitePolygon.findAll({
      where: { primaryUuid },
      order: [["createdAt", "DESC"]],
      include: [{ model: PolygonGeometry, attributes: ["uuid"] }]
    });
  }

  /**
   * Activates a specific version and deactivates all others.
   *
   * This is used for "switching" to a previous version.
   *
   * Process:
   * 1. Find target version
   * 2. Validate it exists and get its primaryUuid
   * 3. Deactivate all other versions in the group
   * 4. Activate target version
   * 5. Track the activation in polygon_updates
   *
   * @param targetUuid - UUID of version to activate
   * @param userId - User performing the activation
   * @param transaction - Database transaction
   * @returns The activated SitePolygon
   */
  async activateVersion(targetUuid: string, userId: number, transaction: Transaction): Promise<SitePolygon> {
    // 1. Find target version
    const targetVersion = await SitePolygon.findOne({
      where: { uuid: targetUuid },
      transaction
    });

    if (targetVersion == null) {
      throw new NotFoundException(`Site polygon version not found: ${targetUuid}`);
    }

    // 2. Deactivate all other versions
    await this.deactivateOtherVersions(targetVersion.primaryUuid, targetUuid, transaction);

    // 3. Activate target version
    targetVersion.isActive = true;
    await targetVersion.save({ transaction });

    // 4. Track activation
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

    this.logger.log(`Activated version ${targetUuid} in group ${targetVersion.primaryUuid}`);

    return targetVersion;
  }

  /**
   * Gets the change history for a polygon from polygon_updates table.
   *
   * @param primaryUuid - The version group identifier
   * @returns Array of PolygonUpdates records ordered by date (newest first)
   */
  async getChangeHistory(primaryUuid: string): Promise<PolygonUpdates[]> {
    return PolygonUpdates.findAll({
      where: { sitePolygonUuid: primaryUuid },
      order: [["createdAt", "DESC"]]
    });
  }

  /**
   * Builds a human-readable change description from attribute changes.
   *
   * Examples:
   * - "poly_name => from 'Old Name' to 'New Name'"
   * - "poly_name => from 'Old' to 'New', num_trees => from 100 to 150"
   *
   * @param oldValues - Previous attribute values
   * @param newValues - New attribute values
   * @returns Formatted change description
   */
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

  /**
   * Validates that a polygon can have a version created from it.
   *
   * Checks:
   * - Polygon exists
   * - Polygon is not deleted
   * - primaryUuid is set correctly
   *
   * @param sitePolygonUuid - UUID to validate
   * @throws NotFoundException if polygon doesn't exist
   * @throws BadRequestException if polygon is invalid for versioning
   */
  async validateVersioningEligibility(sitePolygonUuid: string): Promise<SitePolygon> {
    const polygon = await SitePolygon.findOne({
      where: { uuid: sitePolygonUuid }
    });

    if (polygon == null) {
      throw new NotFoundException(`Site polygon not found: ${sitePolygonUuid}`);
    }

    if (polygon.primaryUuid == null) {
      throw new BadRequestException(`Site polygon ${sitePolygonUuid} has no primaryUuid set. Cannot create version.`);
    }

    return polygon;
  }
}
