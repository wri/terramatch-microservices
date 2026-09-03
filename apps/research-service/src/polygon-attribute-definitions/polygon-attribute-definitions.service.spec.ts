import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import {
  PolygonAttributeDefinition,
  PolygonAttributeDefinitionOption,
  SitePolygonAttributeValue
} from "@terramatch-microservices/database/entities";
import {
  PolygonAttributeDefinitionFactory,
  PolygonAttributeDefinitionOptionFactory,
  SitePolygonAttributeValueFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { generateAttributeKey } from "./attribute-key";
import { PolygonAttributeDefinitionDto } from "./dto/polygon-attribute-definition.dto";
import { PolygonAttributeDefinitionsService } from "./polygon-attribute-definitions.service";

describe("PolygonAttributeDefinitionsService", () => {
  let service: PolygonAttributeDefinitionsService;
  const createdDefinitionIds: number[] = [];

  const uniqueLabel = (prefix: string) => `${prefix} ${faker.string.alpha({ length: 8, casing: "lower" })}`;

  const option = (label: string, uuid?: string) => (uuid == null ? { label } : { uuid, label });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolygonAttributeDefinitionsService]
    }).compile();

    service = module.get(PolygonAttributeDefinitionsService);
    createdDefinitionIds.length = 0;
  });

  afterEach(async () => {
    if (createdDefinitionIds.length > 0) {
      await SitePolygonAttributeValue.destroy({
        where: { polygonAttributeDefinitionId: createdDefinitionIds },
        force: true
      });
      await PolygonAttributeDefinitionOption.destroy({
        where: { polygonAttributeDefinitionId: createdDefinitionIds },
        force: true
      });
      await PolygonAttributeDefinition.destroy({ where: { id: createdDefinitionIds }, force: true });
    }
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("generates a camelCase key from the label and creates options", async () => {
      const label = uniqueLabel("ANR Subcategory");
      const definition = await service.create({
        label,
        inputType: "single_select",
        frameworkKey: "terrafund",
        options: [{ label: "Farmer managed" }, { label: "Assisted" }]
      });
      createdDefinitionIds.push(definition.id);

      expect(definition.key).toBe(generateAttributeKey(label));
      expect(definition.label).toBe(label);
      expect(definition.isActive).toBe(true);
      expect(definition.options).toHaveLength(2);
      expect(definition.options?.map(opt => opt.value)).toEqual(["farmerManaged", "assisted"]);
      expect(definition.options?.map(opt => opt.order)).toEqual([0, 1]);
    });

    it("rejects a reserved key generated from the label", async () => {
      await expect(
        service.create({
          label: "Practice",
          inputType: "single_select",
          frameworkKey: "ppc",
          options: [{ label: "One" }]
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a duplicate (frameworkKey, key)", async () => {
      const label = uniqueLabel("Strata");
      const first = await service.create({
        label,
        inputType: "multi_select",
        frameworkKey: "ppc",
        options: [{ label: "A" }]
      });
      createdDefinitionIds.push(first.id);

      await expect(
        service.create({
          label,
          inputType: "single_select",
          frameworkKey: "ppc",
          options: [{ label: "B" }]
        })
      ).rejects.toThrow(`Attribute key "${first.key}" already exists for framework "ppc"`);
    });

    it("allows the same key on a different framework", async () => {
      const label = uniqueLabel("Strata");
      const ppc = await service.create({
        label,
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "A" }]
      });
      const terrafund = await service.create({
        label,
        inputType: "single_select",
        frameworkKey: "terrafund",
        options: [{ label: "A" }]
      });
      createdDefinitionIds.push(ppc.id, terrafund.id);

      expect(ppc.key).toBe(terrafund.key);
      expect(ppc.frameworkKey).toBe("ppc");
      expect(terrafund.frameworkKey).toBe("terrafund");
    });

    it("rejects duplicate option values generated from labels", async () => {
      await expect(
        service.create({
          label: uniqueLabel("Practices"),
          inputType: "single_select",
          frameworkKey: "ppc",
          options: [{ label: "Farmer managed" }, { label: "farmer managed" }]
        })
      ).rejects.toThrow('Duplicate option value "farmerManaged"');
    });

    it("persists the provided order", async () => {
      const definition = await service.create({
        label: uniqueLabel("Ordered"),
        inputType: "single_select",
        frameworkKey: "ppc",
        order: 5,
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(definition.id);

      expect(definition.order).toBe(5);
    });
  });

  describe("ordering", () => {
    it("findAll returns definitions ordered by order ascending", async () => {
      const first = await service.create({
        label: uniqueLabel("Z last"),
        inputType: "single_select",
        frameworkKey: "terrafund",
        order: 2,
        options: [{ label: "One" }]
      });
      const second = await service.create({
        label: uniqueLabel("A first"),
        inputType: "single_select",
        frameworkKey: "terrafund",
        order: 1,
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(first.id, second.id);

      const orderedCreatedIds = (await service.findAll("terrafund"))
        .map(d => d.id)
        .filter(id => id === first.id || id === second.id);
      expect(orderedCreatedIds).toEqual([second.id, first.id]);
    });

    it("update changes the order", async () => {
      const created = await service.create({
        label: uniqueLabel("Reorder"),
        inputType: "single_select",
        frameworkKey: "ppc",
        order: 0,
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(created.id);

      const updated = await service.update(created, { order: 10 });
      expect(updated.order).toBe(10);
    });
  });

  describe("update", () => {
    it("updates label and active without changing the key", async () => {
      const created = await service.create({
        label: uniqueLabel("Original"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(created.id);
      const originalKey = created.key;

      const updated = await service.update(created, {
        label: uniqueLabel("Renamed"),
        isActive: false
      });

      expect(updated.key).toBe(originalKey);
      expect(updated.isActive).toBe(false);
      expect(updated.inputType).toBe("single_select");
      expect(updated.frameworkKey).toBe("ppc");
    });

    it("replaces options, locking existing values and creating new ones from labels", async () => {
      const created = await service.create({
        label: uniqueLabel("Options"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "Farmer managed" }, { label: "Assisted" }]
      });
      createdDefinitionIds.push(created.id);
      const kept = created.options?.[0];
      expect(kept).toBeDefined();
      if (kept == null) return;

      const updated = await service.update(created, {
        options: [option("Farmer-managed natural regeneration", kept.uuid), option("Coppicing")]
      });

      expect(updated.options).toHaveLength(2);
      expect(updated.options?.[0]?.uuid).toBe(kept.uuid);
      expect(updated.options?.[0]?.value).toBe("farmerManaged");
      expect(updated.options?.[0]?.label).toBe("Farmer-managed natural regeneration");
      expect(updated.options?.[1]?.value).toBe("coppicing");
      expect(updated.options?.[1]?.order).toBe(1);

      const remaining = await PolygonAttributeDefinitionOption.count({
        where: { polygonAttributeDefinitionId: created.id }
      });
      expect(remaining).toBe(2);
    });

    it("rejects an unknown option uuid", async () => {
      const created = await service.create({
        label: uniqueLabel("Unknown option"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(created.id);

      await expect(
        service.update(created, {
          options: [{ uuid: faker.string.uuid(), label: "Nope" }]
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("refuses to remove an option that polygons still store", async () => {
      const created = await service.create({
        label: uniqueLabel("Used option"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "Farmer managed" }, { label: "Assisted" }]
      });
      createdDefinitionIds.push(created.id);
      const used = created.options?.[0];
      const kept = created.options?.[1];
      expect(used).toBeDefined();
      expect(kept).toBeDefined();
      if (used == null || kept == null) return;

      await SitePolygonAttributeValueFactory.definition(created).create({ value: used.value });

      await expect(service.update(created, { options: [option(kept.label, kept.uuid)] })).rejects.toThrow(
        `Cannot remove option "${used.label}" because polygons already have this value. Keep it in the list instead.`
      );
      expect(
        await PolygonAttributeDefinitionOption.count({
          where: { polygonAttributeDefinitionId: created.id }
        })
      ).toBe(2);
    });

    it("allows removing an option that no polygon stores", async () => {
      const created = await service.create({
        label: uniqueLabel("Unused option"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "Farmer managed" }, { label: "Assisted" }]
      });
      createdDefinitionIds.push(created.id);
      const used = created.options?.[0];
      const unused = created.options?.[1];
      expect(used).toBeDefined();
      expect(unused).toBeDefined();
      if (used == null || unused == null) return;

      await SitePolygonAttributeValueFactory.definition(created).create({ value: used.value });

      const updated = await service.update(created, { options: [option(used.label, used.uuid)] });
      expect(updated.options).toHaveLength(1);
      expect(updated.options?.[0]?.uuid).toBe(used.uuid);
    });

    it("allows replacing an in-use option row when the stored value remains", async () => {
      const created = await service.create({
        label: uniqueLabel("Recreate option"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "Farmer managed" }]
      });
      createdDefinitionIds.push(created.id);
      const original = created.options?.[0];
      expect(original).toBeDefined();
      if (original == null) return;

      await SitePolygonAttributeValueFactory.definition(created).create({ value: original.value });

      const updated = await service.update(created, { options: [option("Farmer managed")] });
      expect(updated.options).toHaveLength(1);
      expect(updated.options?.[0]?.value).toBe(original.value);
      expect(updated.options?.[0]?.uuid).not.toBe(original.uuid);
    });

    it("refuses to remove a multi-select option still present in a stored array", async () => {
      const created = await service.create({
        label: uniqueLabel("Multi used option"),
        inputType: "multi_select",
        frameworkKey: "ppc",
        options: [{ label: "Stratum A" }, { label: "Stratum B" }]
      });
      createdDefinitionIds.push(created.id);
      const used = created.options?.[0];
      const kept = created.options?.[1];
      expect(used).toBeDefined();
      expect(kept).toBeDefined();
      if (used == null || kept == null) return;

      await SitePolygonAttributeValueFactory.definition(created).create({ value: [used.value, kept.value] });

      await expect(service.update(created, { options: [option(kept.label, kept.uuid)] })).rejects.toThrow(
        `Cannot remove option "${used.label}" because polygons already have this value. Keep it in the list instead.`
      );
    });
  });

  describe("findAll / findOne", () => {
    it("lists inactive definitions for the framework and excludes other frameworks", async () => {
      const ppcActive = await service.create({
        label: uniqueLabel("Active"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "One" }]
      });
      const ppcInactive = await service.create({
        label: uniqueLabel("Inactive"),
        inputType: "single_select",
        frameworkKey: "ppc",
        isActive: false,
        options: [{ label: "One" }]
      });
      const terrafund = await service.create({
        label: uniqueLabel("Other"),
        inputType: "single_select",
        frameworkKey: "terrafund",
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(ppcActive.id, ppcInactive.id, terrafund.id);

      const listed = await service.findAll("ppc");
      const ids = listed.map(definition => definition.id);
      expect(ids).toEqual(expect.arrayContaining([ppcActive.id, ppcInactive.id]));
      expect(ids).not.toContain(terrafund.id);

      const activeOnlyIds = (await service.findAll("ppc", true)).map(definition => definition.id);
      expect(activeOnlyIds).toContain(ppcActive.id);
      expect(activeOnlyIds).not.toContain(ppcInactive.id);
    });

    it("throws NotFoundException for an unknown uuid", async () => {
      await expect(service.findOne(faker.string.uuid())).rejects.toThrow(NotFoundException);
    });
  });

  describe("delete", () => {
    it("force-deletes an unused definition so the key can be reused", async () => {
      const label = uniqueLabel("Reusable");
      const created = await service.create({
        label,
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "One" }]
      });
      const { id, key } = created;

      await service.delete(created);
      createdDefinitionIds.length = 0;

      expect(await PolygonAttributeDefinition.findByPk(id, { paranoid: false })).toBeNull();
      expect(
        await PolygonAttributeDefinitionOption.count({
          where: { polygonAttributeDefinitionId: id },
          paranoid: false
        })
      ).toBe(0);

      const recreated = await service.create({
        label,
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(recreated.id);
      expect(recreated.key).toBe(key);
    });

    it("refuses to delete when polygon values exist", async () => {
      const created = await service.create({
        label: uniqueLabel("Used"),
        inputType: "single_select",
        frameworkKey: "ppc",
        options: [{ label: "One" }]
      });
      createdDefinitionIds.push(created.id);
      await SitePolygonAttributeValueFactory.definition(created).create({ value: "one" });

      await expect(service.delete(created)).rejects.toThrow(
        "Cannot delete this attribute because polygons already have values for it. Deactivate it instead."
      );
      expect(await PolygonAttributeDefinition.findByPk(created.id)).not.toBeNull();
    });
  });

  describe("addDto", () => {
    it("includes hasValues and ordered options", async () => {
      const definition = await PolygonAttributeDefinitionFactory.create({
        frameworkKey: "ppc",
        key: `key${faker.string.alpha(6)}`,
        isActive: true
      });
      createdDefinitionIds.push(definition.id);
      await PolygonAttributeDefinitionOptionFactory.definition(definition).create({
        label: "Second",
        value: "second",
        order: 1
      });
      await PolygonAttributeDefinitionOptionFactory.definition(definition).create({
        label: "First",
        value: "first",
        order: 0
      });
      await SitePolygonAttributeValueFactory.definition(definition).create({ value: "first" });

      const loaded = await service.findOne(definition.uuid);
      const document = await service.addDto(buildJsonApi(PolygonAttributeDefinitionDto), loaded);
      const serialized = document.serialize();
      const attributes = (serialized.data as unknown as { attributes: PolygonAttributeDefinitionDto }).attributes;

      expect(attributes.hasValues).toBe(true);
      expect(attributes.options.map(opt => opt.value)).toEqual(["first", "second"]);
    });

    it("reports hasValues false when no polygon values exist", async () => {
      const definition = await PolygonAttributeDefinitionFactory.create({
        frameworkKey: "ppc",
        key: `key${faker.string.alpha(6)}`
      });
      createdDefinitionIds.push(definition.id);

      const loaded = await service.findOne(definition.uuid);
      const document = await service.addDto(buildJsonApi(PolygonAttributeDefinitionDto), loaded);
      const attributes = (document.serialize().data as unknown as { attributes: PolygonAttributeDefinitionDto })
        .attributes;
      expect(attributes.hasValues).toBe(false);
      expect(attributes.options).toEqual([]);
    });

    it("batches hasValues for a list", async () => {
      const withValues = await PolygonAttributeDefinitionFactory.create({
        frameworkKey: "ppc",
        key: `key${faker.string.alpha(6)}`
      });
      const withoutValues = await PolygonAttributeDefinitionFactory.create({
        frameworkKey: "ppc",
        key: `key${faker.string.alpha(6)}`
      });
      createdDefinitionIds.push(withValues.id, withoutValues.id);
      await SitePolygonAttributeValueFactory.definition(withValues).create({ value: "a" });

      const document = await service.addDtos(buildJsonApi(PolygonAttributeDefinitionDto, { forceDataArray: true }), [
        (await service.findOne(withValues.uuid)) as never,
        (await service.findOne(withoutValues.uuid)) as never
      ]);
      const rows = document.serialize().data as unknown as Array<{
        id: string;
        attributes: PolygonAttributeDefinitionDto;
      }>;
      const byId = Object.fromEntries(rows.map(row => [row.id, row.attributes.hasValues]));
      expect(byId[withValues.uuid]).toBe(true);
      expect(byId[withoutValues.uuid]).toBe(false);
    });
  });
});
