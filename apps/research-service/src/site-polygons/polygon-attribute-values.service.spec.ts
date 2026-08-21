import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PolygonAttributeDefinition, SitePolygonAttributeValue } from "@terramatch-microservices/database/entities";
import { Op, Transaction } from "sequelize";
import { PolygonAttributeValuesService } from "./polygon-attribute-values.service";

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn()
} as unknown as Transaction;

describe("PolygonAttributeValuesService", () => {
  let service: PolygonAttributeValuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolygonAttributeValuesService]
    }).compile();

    service = module.get(PolygonAttributeValuesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const singleSelectDefinition = {
    id: 1,
    key: "anrSubcategory",
    inputType: "single_select",
    isRequired: false,
    isActive: true,
    frameworkKey: "terrafund",
    options: [
      { value: "farmer-managed", label: "Farmer managed" },
      { value: "assisted", label: "Assisted" }
    ]
  };

  const multiSelectDefinition = {
    id: 2,
    key: "strata",
    inputType: "multi_select",
    isRequired: false,
    isActive: true,
    frameworkKey: "ppc",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" }
    ]
  };

  describe("getMapsByPolygonUuids", () => {
    it("returns sparse maps keyed by polygon uuid and definition key", async () => {
      jest.spyOn(SitePolygonAttributeValue, "findAll").mockResolvedValue([
        {
          sitePolygonUuid: "poly-1",
          polygonAttributeDefinitionId: 1,
          value: "farmer-managed"
        },
        {
          sitePolygonUuid: "poly-1",
          polygonAttributeDefinitionId: 2,
          value: ["a", "b"]
        },
        {
          sitePolygonUuid: "poly-2",
          polygonAttributeDefinitionId: 1,
          value: "assisted"
        }
      ] as SitePolygonAttributeValue[]);
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([
        { id: 1, key: "anrSubcategory" },
        { id: 2, key: "strata" }
      ] as PolygonAttributeDefinition[]);

      const maps = await service.getMapsByPolygonUuids(["poly-1", "poly-2"]);

      expect(SitePolygonAttributeValue.findAll).toHaveBeenCalledWith({
        where: { sitePolygonUuid: { [Op.in]: ["poly-1", "poly-2"] } },
        attributes: ["sitePolygonUuid", "polygonAttributeDefinitionId", "value"]
      });
      expect(PolygonAttributeDefinition.findAll).toHaveBeenCalledWith({
        where: { id: { [Op.in]: [1, 2] } },
        attributes: ["id", "key"],
        paranoid: false
      });
      expect(maps.get("poly-1")).toEqual({
        anrSubcategory: "farmer-managed",
        strata: ["a", "b"]
      });
      expect(maps.get("poly-2")).toEqual({ anrSubcategory: "assisted" });
    });

    it("returns an empty map when no uuids are provided", async () => {
      const findAllSpy = jest.spyOn(SitePolygonAttributeValue, "findAll");
      const maps = await service.getMapsByPolygonUuids([]);
      expect(maps.size).toBe(0);
      expect(findAllSpy).not.toHaveBeenCalled();
    });
  });

  describe("upsert", () => {
    it("upserts valid single_select values", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([singleSelectDefinition] as never);
      const destroySpy = jest.spyOn(SitePolygonAttributeValue, "destroy").mockResolvedValue(0);
      const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

      await service.upsert("poly-uuid", "terrafund", { anrSubcategory: "farmer-managed" }, mockTransaction);

      expect(destroySpy).not.toHaveBeenCalled();
      expect(bulkCreateSpy).toHaveBeenCalledWith(
        [{ sitePolygonUuid: "poly-uuid", polygonAttributeDefinitionId: 1, value: "farmer-managed" }],
        { transaction: mockTransaction, updateOnDuplicate: ["value"] }
      );
    });

    it("clears a value when null is sent", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([singleSelectDefinition] as never);
      const destroySpy = jest.spyOn(SitePolygonAttributeValue, "destroy").mockResolvedValue(1);
      const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

      await service.upsert("poly-uuid", "terrafund", { anrSubcategory: null }, mockTransaction);

      expect(destroySpy).toHaveBeenCalledWith({
        where: {
          sitePolygonUuid: "poly-uuid",
          polygonAttributeDefinitionId: { [Op.in]: [1] }
        },
        transaction: mockTransaction
      });
      expect(bulkCreateSpy).not.toHaveBeenCalled();
    });

    it("rejects unknown keys", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([singleSelectDefinition] as never);

      await expect(service.upsert("poly-uuid", "terrafund", { unknown_key: "x" }, mockTransaction)).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects invalid option values", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([singleSelectDefinition] as never);

      await expect(
        service.upsert("poly-uuid", "terrafund", { anrSubcategory: "not-an-option" }, mockTransaction)
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects wrong types for multi_select", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([multiSelectDefinition] as never);

      await expect(service.upsert("poly-uuid", "ppc", { strata: "a" }, mockTransaction)).rejects.toThrow(
        BadRequestException
      );
    });

    it("sorts multi_select values", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([multiSelectDefinition] as never);
      jest.spyOn(SitePolygonAttributeValue, "destroy").mockResolvedValue(0);
      const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

      await service.upsert("poly-uuid", "ppc", { strata: ["b", "a"] }, mockTransaction);

      expect(bulkCreateSpy).toHaveBeenCalledWith(
        [{ sitePolygonUuid: "poly-uuid", polygonAttributeDefinitionId: 2, value: ["a", "b"] }],
        { transaction: mockTransaction, updateOnDuplicate: ["value"] }
      );
    });

    it("requires frameworkKey when attributes are provided", async () => {
      await expect(service.upsert("poly-uuid", null, { anrSubcategory: "x" }, mockTransaction)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("pickMatchingFromPropertiesBatch", () => {
    it("picks matching keys and ignores leftovers", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([singleSelectDefinition] as never);

      const [matched] = await service.pickMatchingFromPropertiesBatch(
        [{ anrSubcategory: "assisted", plantend: "2020-01-01", est_area: 1.2 }],
        "terrafund",
        mockTransaction
      );

      expect(matched).toEqual({ anrSubcategory: "assisted" });
    });

    it("returns empty maps when framework has no definitions", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([]);

      const result = await service.pickMatchingFromPropertiesBatch(
        [{ anrSubcategory: "assisted" }],
        "terrafund",
        mockTransaction
      );

      expect(result).toEqual([{}]);
    });

    it("drops invalid single_select options without throwing", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([singleSelectDefinition] as never);

      const [matched] = await service.pickMatchingFromPropertiesBatch(
        [{ anrSubcategory: "not-an-option" }],
        "terrafund",
        mockTransaction
      );

      expect(matched).toEqual({ anrSubcategory: null });
    });

    it("keeps only allowlisted multi_select options", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([multiSelectDefinition] as never);

      const [matched] = await service.pickMatchingFromPropertiesBatch(
        [{ strata: ["b", "invalid", "a", "also-bad"] }],
        "ppc",
        mockTransaction
      );

      expect(matched).toEqual({ strata: ["a", "b"] });
    });

    it("returns null for multi_select when all options are invalid", async () => {
      jest.spyOn(PolygonAttributeDefinition, "findAll").mockResolvedValue([multiSelectDefinition] as never);

      const [matched] = await service.pickMatchingFromPropertiesBatch(
        [{ strata: ["invalid", "also-bad"] }],
        "ppc",
        mockTransaction
      );

      expect(matched).toEqual({ strata: null });
    });

    it("drops wrong types without throwing", async () => {
      jest
        .spyOn(PolygonAttributeDefinition, "findAll")
        .mockResolvedValue([singleSelectDefinition, multiSelectDefinition] as never);

      const [matched] = await service.pickMatchingFromPropertiesBatch(
        [{ anrSubcategory: 123, strata: "a" }],
        "ppc",
        mockTransaction
      );

      expect(matched).toEqual({ anrSubcategory: null, strata: null });
    });
  });
});
