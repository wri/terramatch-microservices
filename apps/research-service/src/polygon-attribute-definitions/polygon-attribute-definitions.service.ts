import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import {
  PolygonAttributeDefinition,
  PolygonAttributeDefinitionOption,
  SitePolygonAttributeValue
} from "@terramatch-microservices/database/entities";
import { col, fn, literal, Op, Transaction, UniqueConstraintError } from "sequelize";
import { assertNotReservedAttributeKey, assertValidGeneratedKey, generateAttributeKey } from "./attribute-key";
import {
  CreatePolygonAttributeDefinitionAttributes,
  PolygonAttributeDefinitionDto,
  PolygonAttributeDefinitionOptionDto,
  StorePolygonAttributeDefinitionOptionAttributes,
  UpdatePolygonAttributeDefinitionAttributes
} from "./dto/polygon-attribute-definition.dto";

type DefinitionWithOptions = PolygonAttributeDefinition & {
  options: PolygonAttributeDefinitionOption[] | null;
};

@Injectable()
export class PolygonAttributeDefinitionsService {
  async findAll(frameworkKey: FrameworkKey): Promise<DefinitionWithOptions[]> {
    return (await PolygonAttributeDefinition.findAll({
      where: { frameworkKey },
      include: [{ association: "options", required: false }]
    })) as DefinitionWithOptions[];
  }

  async findOne(uuid: string): Promise<DefinitionWithOptions> {
    const definition = (await PolygonAttributeDefinition.findOne({
      where: { uuid },
      include: [{ association: "options", required: false }]
    })) as DefinitionWithOptions | null;
    if (definition == null) {
      throw new NotFoundException("Polygon attribute definition not found");
    }
    return definition;
  }

  async create(attributes: CreatePolygonAttributeDefinitionAttributes): Promise<DefinitionWithOptions> {
    const key = this.keyFromLabel(attributes.label);
    await this.assertUniqueKey(attributes.frameworkKey, key);

    try {
      return await this.inTransaction(async transaction => {
        const definition = await PolygonAttributeDefinition.create(
          {
            key,
            label: attributes.label,
            inputType: attributes.inputType,
            frameworkKey: attributes.frameworkKey,
            isActive: attributes.isActive ?? true,
            order: attributes.order ?? 0
          },
          { transaction }
        );

        definition.options = await this.replaceOptions(definition, attributes.options, transaction);
        return definition as DefinitionWithOptions;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw this.duplicateKeyError(attributes.frameworkKey, key);
      }
      throw error;
    }
  }

  async update(
    definition: DefinitionWithOptions,
    attributes: UpdatePolygonAttributeDefinitionAttributes
  ): Promise<DefinitionWithOptions> {
    return await this.inTransaction(async transaction => {
      const payload: Partial<PolygonAttributeDefinition> = {};
      if (attributes.label != null) payload.label = attributes.label;
      if (attributes.isActive != null) payload.isActive = attributes.isActive;
      if (attributes.order != null) payload.order = attributes.order;
      if (Object.keys(payload).length > 0) {
        await definition.update(payload, { transaction });
      }

      if (attributes.options != null) {
        definition.options = await this.replaceOptions(definition, attributes.options, transaction);
      } else {
        definition.options ??= await PolygonAttributeDefinitionOption.findAll({
          where: { polygonAttributeDefinitionId: definition.id },
          transaction
        });
      }

      return definition;
    });
  }

  async delete(definition: PolygonAttributeDefinition): Promise<void> {
    if (await this.hasValues(definition.id)) {
      throw new BadRequestException(
        "Cannot delete this attribute because polygons already have values for it. Deactivate it instead."
      );
    }

    // The entity's afterDestroy hook cascades this force-delete to its options.
    await definition.destroy({ force: true });
  }

  async addDto(document: DocumentBuilder, definition: DefinitionWithOptions): Promise<DocumentBuilder> {
    const hasValues = await this.hasValues(definition.id);
    return this.addDtoToDocument(document, definition, hasValues);
  }

  async addDtos(document: DocumentBuilder, definitions: DefinitionWithOptions[]): Promise<DocumentBuilder> {
    const counts = await this.valueCountsByDefinitionId(definitions.map(definition => definition.id));
    for (const definition of definitions) {
      this.addDtoToDocument(document, definition, (counts.get(definition.id) ?? 0) > 0);
    }
    return document;
  }

  private addDtoToDocument(
    document: DocumentBuilder,
    definition: DefinitionWithOptions,
    hasValues: boolean
  ): DocumentBuilder {
    const options = [...(definition.options ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(
        (option): PolygonAttributeDefinitionOptionDto => ({
          uuid: option.uuid,
          value: option.value,
          label: option.label,
          order: option.order
        })
      );

    document.addData(definition.uuid, new PolygonAttributeDefinitionDto(definition, { hasValues, options }));
    return document;
  }

  private async inTransaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return await PolygonAttributeDefinition.sql.transaction(work);
  }

  private keyFromLabel(label: string): string {
    const key = generateAttributeKey(label);
    assertValidGeneratedKey(key, label);
    assertNotReservedAttributeKey(key);
    return key;
  }

  private async assertUniqueKey(frameworkKey: FrameworkKey, key: string): Promise<void> {
    const existing = await PolygonAttributeDefinition.findOne({
      where: { frameworkKey, key }
    });
    if (existing != null) {
      throw this.duplicateKeyError(frameworkKey, key);
    }
  }

  private duplicateKeyError(frameworkKey: FrameworkKey, key: string): BadRequestException {
    return new BadRequestException(`Attribute key "${key}" already exists for framework "${frameworkKey}"`);
  }

  private async replaceOptions(
    definition: PolygonAttributeDefinition,
    optionAttributes: StorePolygonAttributeDefinitionOptionAttributes[],
    transaction: Transaction
  ): Promise<PolygonAttributeDefinitionOption[]> {
    const existing = await PolygonAttributeDefinitionOption.findAll({
      where: { polygonAttributeDefinitionId: definition.id },
      transaction
    });
    const existingByUuid = new Map(existing.map(option => [option.uuid, option]));
    const saved: PolygonAttributeDefinitionOption[] = [];
    const usedValues = new Set<string>();

    for (const [index, attrs] of optionAttributes.entries()) {
      let option: PolygonAttributeDefinitionOption;
      if (attrs.uuid != null) {
        const found = existingByUuid.get(attrs.uuid);
        if (found == null) {
          throw new BadRequestException(`Unknown option uuid: ${attrs.uuid}`);
        }
        found.label = attrs.label;
        found.order = index;
        await found.save({ transaction });
        option = found;
      } else {
        const value = generateAttributeKey(attrs.label);
        assertValidGeneratedKey(value, attrs.label);
        option = await PolygonAttributeDefinitionOption.create(
          {
            polygonAttributeDefinitionId: definition.id,
            label: attrs.label,
            value,
            order: index
          },
          { transaction }
        );
      }

      if (usedValues.has(option.value)) {
        throw new BadRequestException(`Duplicate option value "${option.value}"`);
      }
      usedValues.add(option.value);
      saved.push(option);
    }

    const savedIds = new Set(saved.map(option => option.id));
    const removedStillInSchema = existing.filter(option => !savedIds.has(option.id) && !usedValues.has(option.value));
    await this.assertOptionsNotStoredOnPolygons(definition.id, removedStillInSchema, transaction);

    await PolygonAttributeDefinitionOption.destroy({
      where: {
        polygonAttributeDefinitionId: definition.id,
        id: { [Op.notIn]: saved.map(option => option.id) }
      },
      transaction
    });

    return saved;
  }

  private async assertOptionsNotStoredOnPolygons(
    definitionId: number,
    options: PolygonAttributeDefinitionOption[],
    transaction: Transaction
  ): Promise<void> {
    if (options.length === 0) return;

    const inUse: PolygonAttributeDefinitionOption[] = [];
    for (const option of options) {
      const stored = await SitePolygonAttributeValue.findOne({
        where: {
          polygonAttributeDefinitionId: definitionId,
          [Op.and]: [
            literal(`(
              JSON_UNQUOTE(\`value\`) = ${SitePolygonAttributeValue.sql.escape(option.value)}
              OR JSON_CONTAINS(\`value\`, ${SitePolygonAttributeValue.sql.escape(JSON.stringify(option.value))}, '$') = 1
            )`)
          ]
        },
        attributes: ["id"],
        transaction
      });
      if (stored != null) inUse.push(option);
    }

    if (inUse.length === 0) return;

    const labels = inUse.map(option => `"${option.label}"`).join(", ");
    throw new BadRequestException(
      inUse.length === 1
        ? `Cannot remove option ${labels} because polygons already have this value. Keep it in the list instead.`
        : `Cannot remove options ${labels} because polygons already have these values. Keep them in the list instead.`
    );
  }

  private async hasValues(definitionId: number): Promise<boolean> {
    return (
      (await SitePolygonAttributeValue.count({
        where: { polygonAttributeDefinitionId: definitionId }
      })) > 0
    );
  }

  private async valueCountsByDefinitionId(ids: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (ids.length === 0) return counts;

    const rows = await SitePolygonAttributeValue.findAll({
      attributes: ["polygonAttributeDefinitionId", [fn("COUNT", col("id")), "count"]],
      where: { polygonAttributeDefinitionId: { [Op.in]: ids } },
      group: ["polygonAttributeDefinitionId"]
    });

    for (const row of rows) {
      counts.set(row.polygonAttributeDefinitionId, Number(row.get("count")));
    }
    return counts;
  }
}
