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

function coerceToStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map(item => item.trim());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return [];
    if (trimmed.startsWith("[")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed) as unknown;
      } catch {
        parsed = undefined;
      }
      if (Array.isArray(parsed)) {
        return parsed.map(String).map(item => item.trim());
      }
    }

    return trimmed
      .split(",")
      .map(item => item.trim())
      .filter(item => item !== "");
  }

  return [];
}

@Injectable()
export class PolygonAttributeValuesService {
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

  async upsert(
    sitePolygonUuid: string,
    frameworkKey: FrameworkKey | null | undefined,
    attributes: CustomAttributeMap,
    transaction: Transaction
  ): Promise<void> {
    await this.bulkUpsert(frameworkKey, [{ sitePolygonUuid, attributes }], transaction);
  }

  async bulkUpsert(
    frameworkKey: FrameworkKey | null | undefined,
    rows: Array<{ sitePolygonUuid: string; attributes: CustomAttributeMap }>,
    transaction: Transaction
  ): Promise<void> {
    const nonEmptyRows = rows.filter(row => Object.keys(row.attributes).length > 0);
    if (nonEmptyRows.length === 0) return;

    if (frameworkKey == null) {
      throw new BadRequestException("Site has no frameworkKey; cannot set custom attributes");
    }

    const definitions = await this.loadActiveDefinitions(frameworkKey, transaction);
    const definitionByKey = new Map(definitions.map(definition => [definition.key, definition]));

    const toClear: Array<{ sitePolygonUuid: string; polygonAttributeDefinitionId: number }> = [];
    const toUpsert: Array<{
      sitePolygonUuid: string;
      polygonAttributeDefinitionId: number;
      value: SitePolygonAttributeValueData;
    }> = [];

    for (const { sitePolygonUuid, attributes } of nonEmptyRows) {
      for (const [key, rawValue] of Object.entries(attributes)) {
        const definition = definitionByKey.get(key);
        if (definition == null) {
          throw new BadRequestException(`Unknown or inactive custom attribute: ${key}`);
        }

        const validated = this.validateValue(definition, rawValue);
        if (validated == null) {
          toClear.push({ sitePolygonUuid, polygonAttributeDefinitionId: definition.id });
        } else {
          toUpsert.push({
            sitePolygonUuid,
            polygonAttributeDefinitionId: definition.id,
            value: validated
          });
        }
      }
    }

    if (toClear.length > 0) {
      await SitePolygonAttributeValue.destroy({
        where: {
          [Op.or]: toClear.map(({ sitePolygonUuid, polygonAttributeDefinitionId }) => ({
            sitePolygonUuid,
            polygonAttributeDefinitionId
          }))
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
        matched[definition.key] = this.filterValueForUpload(definition, properties[definition.key]);
      }
      return matched;
    });
  }

  filterNonNullAttributes(attributes: CustomAttributeMap): CustomAttributeMap {
    const result: CustomAttributeMap = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (value != null) {
        result[key] = value;
      }
    }
    return result;
  }

  async getActiveKeysByFrameworkKeys(
    frameworkKeys: Array<FrameworkKey | null | undefined>
  ): Promise<Map<FrameworkKey, string[]>> {
    const unique = [...new Set(frameworkKeys.filter((key): key is FrameworkKey => key != null))];
    const result = new Map<FrameworkKey, string[]>();
    if (unique.length === 0) return result;

    const definitions = await PolygonAttributeDefinition.findAll({
      where: { frameworkKey: { [Op.in]: unique }, isActive: true },
      attributes: ["frameworkKey", "key"],
      order: [
        ["order", "ASC"],
        ["id", "ASC"]
      ]
    });

    for (const definition of definitions) {
      const list = result.get(definition.frameworkKey) ?? [];
      list.push(definition.key);
      result.set(definition.frameworkKey, list);
    }

    return result;
  }

  async ingestFromProperties(
    sitePolygonUuid: string,
    frameworkKey: FrameworkKey | null | undefined,
    properties: Record<string, unknown>,
    transaction: Transaction
  ): Promise<CustomAttributeMap> {
    const matched = await this.pickMatchingFromProperties(properties, frameworkKey, transaction);
    const toUpsert = this.filterNonNullAttributes(matched);
    if (Object.keys(toUpsert).length === 0) return matched;

    await this.upsert(sitePolygonUuid, frameworkKey, toUpsert, transaction);
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
      return null;
    }

    const allowedValues = new Set((definition.options ?? []).map(option => option.value));

    if (definition.inputType === "single_select") {
      if (typeof rawValue !== "string") {
        throw new BadRequestException(`Custom attribute "${definition.key}" must be a string or null`);
      }
      const trimmed = rawValue.trim();
      if (trimmed.length === 0) {
        return null;
      }
      if (!allowedValues.has(trimmed)) {
        throw new BadRequestException(`Invalid option for custom attribute "${definition.key}": ${trimmed}`);
      }
      return trimmed;
    }

    if (!Array.isArray(rawValue) && typeof rawValue !== "string") {
      throw new BadRequestException(
        `Custom attribute "${definition.key}" must be a string array, comma-separated string, or null`
      );
    }

    const values = coerceToStringArray(rawValue);
    if (values.length === 0) {
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

  private filterValueForUpload(
    definition: DefinitionWithOptions,
    rawValue: unknown
  ): SitePolygonAttributeValueData | null {
    if (rawValue === null || rawValue === undefined) return null;

    const allowedValues = new Set((definition.options ?? []).map(option => option.value));

    if (definition.inputType === "single_select") {
      if (typeof rawValue !== "string") return null;
      const trimmed = rawValue.trim();
      if (trimmed.length === 0) return null;
      return allowedValues.has(trimmed) ? trimmed : null;
    }

    const values = coerceToStringArray(rawValue);
    const filtered = values.filter(value => allowedValues.has(value));
    return filtered.length > 0 ? [...filtered].sort() : null;
  }
}
