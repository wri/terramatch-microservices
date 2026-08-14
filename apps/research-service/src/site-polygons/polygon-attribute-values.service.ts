import { BadRequestException, Injectable } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import {
  PolygonAttributeDefinition,
  PolygonAttributeDefinitionOption,
  SitePolygonAttributeValue,
  SitePolygonAttributeValueData
} from "@terramatch-microservices/database/entities";
import { Op, Transaction } from "sequelize";

export type CustomAttributeMap = Record<string, SitePolygonAttributeValueData | null>;

type DefinitionWithOptions = PolygonAttributeDefinition & {
  options: PolygonAttributeDefinitionOption[] | null;
};

@Injectable()
export class PolygonAttributeValuesService {
  /**
   * Batch-load stored custom attribute values keyed by site polygon UUID.
   * Returns a sparse map (only definitions that have a value row).
   */
  async getMapsByPolygonUuids(uuids: string[]): Promise<Map<string, CustomAttributeMap>> {
    const result = new Map<string, CustomAttributeMap>();
    if (uuids.length === 0) return result;

    const rows = await SitePolygonAttributeValue.findAll({
      where: { sitePolygonUuid: { [Op.in]: uuids } },
      attributes: ["sitePolygonUuid", "polygonAttributeDefinitionId", "value"]
    });

    if (rows.length === 0) return result;

    const definitionIds = [...new Set(rows.map(row => row.polygonAttributeDefinitionId))];
    const definitions = await PolygonAttributeDefinition.findAll({
      where: { id: { [Op.in]: definitionIds } },
      attributes: ["id", "key"],
      paranoid: false
    });
    const keyByDefinitionId = new Map(definitions.map(definition => [definition.id, definition.key]));

    for (const row of rows) {
      const key = keyByDefinitionId.get(row.polygonAttributeDefinitionId);
      if (key == null) continue;

      let map = result.get(row.sitePolygonUuid);
      if (map == null) {
        map = {};
        result.set(row.sitePolygonUuid, map);
      }
      map[key] = row.value;
    }

    return result;
  }

  /**
   * Validate and upsert custom attribute values for one polygon version.
   * `null` (or `[]` for multi_select) clears the stored value (row deleted).
   * Omitted keys are left untouched.
   */
  async upsert(
    sitePolygonUuid: string,
    frameworkKey: FrameworkKey | null | undefined,
    attributes: CustomAttributeMap,
    transaction: Transaction
  ): Promise<void> {
    const entries = Object.entries(attributes);
    if (entries.length === 0) return;

    if (frameworkKey == null) {
      throw new BadRequestException("Site has no frameworkKey; cannot set custom attributes");
    }

    const definitions = await this.loadActiveDefinitions(frameworkKey, transaction);
    const definitionByKey = new Map(definitions.map(definition => [definition.key, definition]));

    const toClearIds: number[] = [];
    const toUpsert: Array<{
      sitePolygonUuid: string;
      polygonAttributeDefinitionId: number;
      value: SitePolygonAttributeValueData;
    }> = [];

    for (const [key, rawValue] of entries) {
      const definition = definitionByKey.get(key);
      if (definition == null) {
        throw new BadRequestException(`Unknown or inactive custom attribute: ${key}`);
      }

      const validated = this.validateValue(definition, rawValue);
      if (validated == null) {
        toClearIds.push(definition.id);
      } else {
        toUpsert.push({
          sitePolygonUuid,
          polygonAttributeDefinitionId: definition.id,
          value: validated
        });
      }
    }

    if (toClearIds.length > 0) {
      await SitePolygonAttributeValue.destroy({
        where: {
          sitePolygonUuid,
          polygonAttributeDefinitionId: { [Op.in]: toClearIds }
        },
        transaction
      });
    }

    if (toUpsert.length > 0) {
      await SitePolygonAttributeValue.bulkCreate(toUpsert as SitePolygonAttributeValue[], {
        transaction,
        updateOnDuplicate: ["value"]
      });
    }
  }

  /**
   * Pick GeoJSON feature properties that match active definition keys for the framework,
   * validate them, and return the map to upsert. Non-matching properties are ignored.
   */
  async pickMatchingFromProperties(
    properties: Record<string, unknown>,
    frameworkKey: FrameworkKey | null | undefined,
    transaction?: Transaction
  ): Promise<CustomAttributeMap> {
    const [matched] = await this.pickMatchingFromPropertiesBatch([properties], frameworkKey, transaction);
    return matched ?? {};
  }

  async pickMatchingFromPropertiesBatch(
    propertiesList: Record<string, unknown>[],
    frameworkKey: FrameworkKey | null | undefined,
    transaction?: Transaction
  ): Promise<CustomAttributeMap[]> {
    if (propertiesList.length === 0) return [];
    if (frameworkKey == null) return propertiesList.map(() => ({}));

    const definitions = await this.loadActiveDefinitions(frameworkKey, transaction);
    if (definitions.length === 0) return propertiesList.map(() => ({}));

    return propertiesList.map(properties => {
      const matched: CustomAttributeMap = {};
      for (const definition of definitions) {
        if (!(definition.key in properties)) continue;
        matched[definition.key] = this.validateValue(definition, properties[definition.key]);
      }
      return matched;
    });
  }

  async ingestFromProperties(
    sitePolygonUuid: string,
    frameworkKey: FrameworkKey | null | undefined,
    properties: Record<string, unknown>,
    transaction: Transaction
  ): Promise<CustomAttributeMap> {
    const matched = await this.pickMatchingFromProperties(properties, frameworkKey, transaction);
    if (Object.keys(matched).length === 0) return matched;

    await this.upsert(sitePolygonUuid, frameworkKey, matched, transaction);
    return matched;
  }

  private async loadActiveDefinitions(
    frameworkKey: FrameworkKey,
    transaction?: Transaction
  ): Promise<DefinitionWithOptions[]> {
    return (await PolygonAttributeDefinition.findAll({
      where: { frameworkKey, isActive: true },
      include: [{ association: "options", required: false }],
      transaction
    })) as DefinitionWithOptions[];
  }

  private validateValue(definition: DefinitionWithOptions, rawValue: unknown): SitePolygonAttributeValueData | null {
    if (rawValue === null || rawValue === undefined) {
      if (definition.isRequired) {
        throw new BadRequestException(`Custom attribute "${definition.key}" is required`);
      }
      return null;
    }

    const allowedValues = new Set((definition.options ?? []).map(option => option.value));

    if (definition.inputType === "single_select") {
      if (typeof rawValue !== "string") {
        throw new BadRequestException(`Custom attribute "${definition.key}" must be a string or null`);
      }
      if (rawValue.length === 0) {
        if (definition.isRequired) {
          throw new BadRequestException(`Custom attribute "${definition.key}" is required`);
        }
        return null;
      }
      if (!allowedValues.has(rawValue)) {
        throw new BadRequestException(`Invalid option for custom attribute "${definition.key}": ${rawValue}`);
      }
      return rawValue;
    }

    // multi_select
    if (!Array.isArray(rawValue) || rawValue.some(item => typeof item !== "string")) {
      throw new BadRequestException(`Custom attribute "${definition.key}" must be a string array or null`);
    }

    const values = rawValue as string[];
    if (values.length === 0) {
      if (definition.isRequired) {
        throw new BadRequestException(`Custom attribute "${definition.key}" is required`);
      }
      return null;
    }

    const invalid = values.filter(value => !allowedValues.has(value));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid option(s) for custom attribute "${definition.key}": ${invalid.join(", ")}`
      );
    }

    return [...values].sort();
  }
}
