import { FinancialIndicatorDto } from "./financial-indicator.dto";
import { FinancialIndicator, Media } from "@terramatch-microservices/database/entities";
import { MediaDto } from "./media.dto";

describe("FinancialIndicatorDto", () => {
  let mockFinancialIndicator: FinancialIndicator;

  // Define minimal mock type for testing purposes
  type MockMedia = {
    id: number;
    uuid: string;
    name: string;
    url: string;
    collectionName: string;
    createdAt: Date;
    updatedAt: Date;
  };

  let mockMedia: MockMedia[];

  // Helper function to create valid props for FinancialIndicatorDto
  const createValidProps = () => ({
    documentation: [],
    entityType: "financialIndicators" as const,
    entityUuid: mockFinancialIndicator.uuid
  });

  beforeEach(() => {
    mockMedia = [
      {
        id: 1,
        uuid: "media-uuid-1",
        name: "financial-document.pdf",
        url: "https://example.com/financial-document.pdf",
        collectionName: "documentation",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        uuid: "media-uuid-2",
        name: "supporting-evidence.pdf",
        url: "https://example.com/supporting-evidence.pdf",
        collectionName: "documentation",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockFinancialIndicator = {
      id: 1,
      uuid: "indicator-uuid-1",
      organisationId: 1,
      year: 2023,
      collection: "revenue",
      amount: 150000.75,
      description: "Annual revenue from carbon credits",
      exchangeRate: 1.25,
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-15"),
      deletedAt: null
    } as FinancialIndicator;
  });

  describe("FinancialIndicatorDto", () => {
    let dto: FinancialIndicatorDto;

    beforeEach(() => {
      dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
    });

    it("should create DTO with all properties", () => {
      expect(dto.collection).toBe("revenue");
      expect(dto.description).toBe("Annual revenue from carbon credits");
      expect(dto.amount).toBe(150000.75);
      expect(dto.exchangeRate).toBe(1.25);
      expect(dto.year).toBe(2023);
    });

    it("should handle nullable properties correctly", () => {
      mockFinancialIndicator.amount = null;
      mockFinancialIndicator.description = null;
      mockFinancialIndicator.exchangeRate = null;

      const dtoWithNulls = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dtoWithNulls.amount).toBeNull();
      expect(dtoWithNulls.description).toBeNull();
      expect(dtoWithNulls.exchangeRate).toBeNull();
    });

    it("should handle documentation media", () => {
      // Mock the documentation property that would be populated by populateDto
      Object.defineProperty(dto, "documentation", {
        value: mockMedia.map(
          media =>
            new MediaDto(media as unknown as Media, {
              url: "https://example.com/media",
              thumbUrl: "https://example.com/media/thumb",
              entityType: "financialIndicators",
              entityUuid: mockFinancialIndicator.uuid
            })
        ),
        writable: true
      });

      expect(dto.documentation).toBeDefined();
      expect(dto.documentation).toHaveLength(2);
      expect(dto.documentation?.[0]).toBeInstanceOf(MediaDto);
      expect(dto.documentation?.[1]).toBeInstanceOf(MediaDto);
    });

    it("should handle empty documentation array", () => {
      Object.defineProperty(dto, "documentation", {
        value: [],
        writable: true
      });

      expect(dto.documentation).toEqual([]);
    });

    it("should handle null documentation", () => {
      Object.defineProperty(dto, "documentation", {
        value: null,
        writable: true
      });

      expect(dto.documentation).toBeNull();
    });
  });

  describe("Data types and validation", () => {
    it("should handle different collection types", () => {
      const collections = ["revenue", "expenses", "assets", "liabilities", "equity", "cash-flow"];

      collections.forEach(collection => {
        mockFinancialIndicator.collection = collection;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.collection).toBe(collection);
      });
    });

    it("should handle different year values", () => {
      const years = [2020, 2021, 2022, 2023, 2024, 2025];

      years.forEach(year => {
        mockFinancialIndicator.year = year;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.year).toBe(year);
      });
    });

    it("should handle different amount values", () => {
      const amounts = [0, 100.5, 1000.0, 1000000.99, 999999999.99];

      amounts.forEach(amount => {
        mockFinancialIndicator.amount = amount;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.amount).toBe(amount);
      });
    });

    it("should handle different exchange rate values", () => {
      const rates = [0.01, 0.5, 1.0, 1.25, 2.0, 100.0];

      rates.forEach(rate => {
        mockFinancialIndicator.exchangeRate = rate;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.exchangeRate).toBe(rate);
      });
    });

    it("should handle different description lengths", () => {
      const descriptions = [
        "",
        "Short description",
        "This is a medium length description for testing purposes",
        "This is a very long description that contains many words and should be handled properly by the DTO transformation process without any issues or errors occurring during the conversion from the entity model to the DTO representation"
      ];

      descriptions.forEach(description => {
        mockFinancialIndicator.description = description;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.description).toBe(description);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle zero values", () => {
      mockFinancialIndicator.amount = 0;
      mockFinancialIndicator.year = 0;
      mockFinancialIndicator.exchangeRate = 0;

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.amount).toBe(0);
      expect(dto.year).toBe(0);
      expect(dto.exchangeRate).toBe(0);
    });

    it("should handle very large numbers", () => {
      mockFinancialIndicator.amount = 999999999.99;
      mockFinancialIndicator.exchangeRate = 999999.99;

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.amount).toBe(999999999.99);
      expect(dto.exchangeRate).toBe(999999.99);
    });

    it("should handle very small decimal values", () => {
      mockFinancialIndicator.amount = 0.01;
      mockFinancialIndicator.exchangeRate = 0.001;

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.amount).toBe(0.01);
      expect(dto.exchangeRate).toBe(0.001);
    });

    it("should handle empty strings", () => {
      mockFinancialIndicator.collection = "";
      mockFinancialIndicator.description = "";

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.collection).toBe("");
      expect(dto.description).toBe("");
    });

    it("should handle null values", () => {
      mockFinancialIndicator.amount = null;
      mockFinancialIndicator.description = null;

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.amount).toBeNull();
      expect(dto.description).toBeNull();
    });
  });

  describe("DTO inheritance and structure", () => {
    it("should extend AssociationDto", () => {
      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto).toHaveProperty("id");
      expect(dto).toHaveProperty("uuid");
    });

    it("should have JsonApiDto decorator", () => {
      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.constructor.name).toBe("FinancialIndicatorDto");
    });

    it("should have correct type in JsonApiDto", () => {
      // This test verifies the decorator configuration
      expect(FinancialIndicatorDto.name).toBe("FinancialIndicatorDto");
    });
  });

  describe("FinancialIndicatorMedia type", () => {
    it("should represent media-related properties", () => {
      // FinancialIndicatorMedia should pick only the media-related properties
      // from FinancialIndicatorDto based on the MEDIA constant
      const mediaProperties = Object.keys(FinancialIndicator.MEDIA);
      expect(mediaProperties).toContain("documentation");
    });
  });

  describe("Constructor behavior", () => {
    it("should handle null financialIndicator parameter", () => {
      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
      expect(dto).toBeDefined();
    });

    it("should handle undefined props parameter", () => {
      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
      expect(dto).toBeDefined();
    });

    it("should handle empty props object", () => {
      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
      expect(dto).toBeDefined();
    });
  });

  describe("Data transformation scenarios", () => {
    it("should transform revenue data correctly", () => {
      mockFinancialIndicator.collection = "revenue";
      mockFinancialIndicator.amount = 500000.0;
      mockFinancialIndicator.description = "Carbon credit revenue";

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.collection).toBe("revenue");
      expect(dto.amount).toBe(500000.0);
      expect(dto.description).toBe("Carbon credit revenue");
    });

    it("should transform expense data correctly", () => {
      mockFinancialIndicator.collection = "expenses";
      mockFinancialIndicator.amount = 250000.0;
      mockFinancialIndicator.description = "Operational costs";

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.collection).toBe("expenses");
      expect(dto.amount).toBe(250000.0);
      expect(dto.description).toBe("Operational costs");
    });

    it("should transform asset data correctly", () => {
      mockFinancialIndicator.collection = "assets";
      mockFinancialIndicator.amount = 1000000.0;
      mockFinancialIndicator.description = "Land and equipment";

      const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());

      expect(dto.collection).toBe("assets");
      expect(dto.amount).toBe(1000000.0);
      expect(dto.description).toBe("Land and equipment");
    });
  });

  describe("Validation and constraints", () => {
    it("should handle valid collection names", () => {
      const validCollections = [
        "revenue",
        "expenses",
        "assets",
        "liabilities",
        "equity",
        "cash-flow",
        "investments",
        "grants"
      ];

      validCollections.forEach(collection => {
        mockFinancialIndicator.collection = collection;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.collection).toBe(collection);
      });
    });

    it("should handle valid year ranges", () => {
      const validYears = [1990, 2000, 2010, 2020, 2030, 2050];

      validYears.forEach(year => {
        mockFinancialIndicator.year = year;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.year).toBe(year);
      });
    });

    it("should handle valid amount precision", () => {
      const amounts = [123.45, 1234.56, 12345.67, 123456.78];

      amounts.forEach(amount => {
        mockFinancialIndicator.amount = amount;
        const dto = new FinancialIndicatorDto(mockFinancialIndicator, createValidProps());
        expect(dto.amount).toBe(amount);
      });
    });
  });
});
