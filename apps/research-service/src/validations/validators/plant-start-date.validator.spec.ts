import { Test, TestingModule } from "@nestjs/testing";
import { PlantStartDateValidator } from "./plant-start-date.validator";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

describe("PlantStartDateValidator", () => {
  let validator: PlantStartDateValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlantStartDateValidator]
    }).compile();

    validator = module.get<PlantStartDateValidator>(PlantStartDateValidator);
  });

  describe("validatePolygon", () => {
    it("should return valid when plant start date is valid and within acceptable range", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: new Date("2020-06-15"),
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return invalid when plant start date is missing", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: null,
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "MISSING_VALUE",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site"
      });
    });

    it("should return invalid when plant start date is empty string", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo?.errorType).toBe("MISSING_VALUE");
    });

    it("should return invalid when plant start date is '0000-00-00'", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "0000-00-00",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "INVALID_FORMAT",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site",
        providedValue: "0000-00-00"
      });
    });

    it("should return invalid when plant start date is before 2018-01-01", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2017-12-31",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "DATE_TOO_EARLY",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site",
        providedValue: "2017-12-31",
        minDate: "2018-01-01"
      });
    });

    it("should return invalid when plant start date is in the future", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateString = futureDate.toISOString().split("T")[0];

      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: futureDateString,
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "DATE_IN_FUTURE",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site",
        providedValue: futureDateString,
        currentDate: expect.any(String)
      });
    });

    it("should return invalid when plant start date is outside site range (too early)", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2018-06-01", // Within min date but outside site range
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2021-01-01") // Site starts in 2021, so 2018-06-01 is too early
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "DATE_OUTSIDE_SITE_RANGE",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site",
        providedValue: "2018-06-01",
        siteStartDate: "2021-01-01",
        allowedRange: {
          min: "2019-01-01",
          max: "2023-01-01"
        }
      });
    });

    it("should return invalid when plant start date is outside site range (too late)", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2022-01-01", // 3 years after site start
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "DATE_OUTSIDE_SITE_RANGE",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site",
        providedValue: "2022-01-01",
        siteStartDate: "2019-01-01",
        allowedRange: {
          min: "2017-01-01",
          max: "2021-01-01"
        }
      });
    });

    it("should return valid when plant start date is within site range", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2020-06-15", // Within 2 years of site start
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid when site has no start date", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2020-06-15",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: null
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return invalid when plant start date has invalid format", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "invalid-date",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        errorType: "PARSE_ERROR",
        polygonUuid: "test-uuid",
        polygonName: "Test Polygon",
        siteName: "Test Site",
        providedValue: "invalid-date",
        errorDetails: "Invalid date format"
      });
    });

    it("should throw NotFoundException when site polygon is not found", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      await expect(validator.validatePolygon("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should handle edge case with exactly 2 years before site start", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2018-01-01", // Exactly 2 years before site start (and at min date)
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2020-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should handle edge case with exactly 2 years after site start", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2021-01-01", // Exactly 2 years after site start
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons correctly", async () => {
      const mockSitePolygons = [
        {
          polygonUuid: "uuid-1",
          polyName: "Test Polygon 1",
          plantStart: "2020-06-15",
          siteUuid: "site-uuid-1",
          site: {
            name: "Test Site 1",
            startDate: new Date("2019-01-01")
          }
        },
        {
          polygonUuid: "uuid-2",
          polyName: "Test Polygon 2",
          plantStart: null,
          siteUuid: "site-uuid-2",
          site: {
            name: "Test Site 2",
            startDate: new Date("2019-01-01")
          }
        }
      ] as unknown as SitePolygon[];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(mockSitePolygons);

      const result = await validator.validatePolygons(["uuid-1", "uuid-2"]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: true,
        extraInfo: null
      });
      expect(result[1]).toEqual({
        polygonUuid: "uuid-2",
        valid: false,
        extraInfo: {
          errorType: "MISSING_VALUE",
          polygonUuid: "uuid-2",
          polygonName: "Test Polygon 2",
          siteName: "Test Site 2"
        }
      });
    });

    it("should handle empty polygon list", async () => {
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await validator.validatePolygons([]);

      expect(result).toEqual([]);
    });
  });

  describe("date validation edge cases", () => {
    it("should handle string date format correctly", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2020-06-15",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should handle Date object format correctly", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: new Date("2020-06-15"),
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should handle site without name", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2020-06-15",
        siteUuid: "site-uuid-1",
        site: {
          name: null,
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should handle polygon without name", async () => {
      const mockSitePolygon = {
        polyName: null,
        plantStart: "2020-06-15",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });
  });
});
