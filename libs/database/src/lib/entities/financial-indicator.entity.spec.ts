import { FinancialIndicator } from "./financial-indicator.entity";

describe("FinancialIndicator", () => {
  let financialIndicator: FinancialIndicator;

  beforeEach(() => {
    financialIndicator = new FinancialIndicator();
    financialIndicator.id = 1;
    financialIndicator.uuid = "indicator-uuid-1";
    financialIndicator.organisationId = 1;
    financialIndicator.year = 2023;
    financialIndicator.collection = "test-collection";
    financialIndicator.amount = 1000.5;
    financialIndicator.description = "Test financial indicator description";
    financialIndicator.exchangeRate = 1.25;
    financialIndicator.createdAt = new Date();
    financialIndicator.updatedAt = new Date();
  });

  describe("Static properties", () => {
    it("should have correct LARAVEL_TYPE", () => {
      expect(FinancialIndicator.LARAVEL_TYPE).toBe("App\\Models\\V2\\FinancialIndicator");
    });

    it("should have MEDIA configuration", () => {
      expect(FinancialIndicator.MEDIA).toBeDefined();
      expect(FinancialIndicator.MEDIA.documentation).toBeDefined();
      expect(FinancialIndicator.MEDIA.documentation.dbCollection).toBe("documentation");
      expect(FinancialIndicator.MEDIA.documentation.multiple).toBe(true);
      expect(FinancialIndicator.MEDIA.documentation.validation).toBe("general-documents");
    });
  });

  describe("Instance properties", () => {
    it("should have all required properties", () => {
      expect(financialIndicator.id).toBe(1);
      expect(financialIndicator.uuid).toBe("indicator-uuid-1");
      expect(financialIndicator.organisationId).toBe(1);
      expect(financialIndicator.year).toBe(2023);
      expect(financialIndicator.collection).toBe("test-collection");
      expect(financialIndicator.amount).toBe(1000.5);
      expect(financialIndicator.description).toBe("Test financial indicator description");
      expect(financialIndicator.exchangeRate).toBe(1.25);
    });

    it("should have timestamps", () => {
      expect(financialIndicator.createdAt).toBeInstanceOf(Date);
      expect(financialIndicator.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("Data types", () => {
    it("should handle numeric values correctly", () => {
      financialIndicator.amount = 0;
      expect(financialIndicator.amount).toBe(0);

      financialIndicator.amount = 999999.99;
      expect(financialIndicator.amount).toBe(999999.99);

      financialIndicator.amount = null;
      expect(financialIndicator.amount).toBeNull();
    });

    it("should handle year values correctly", () => {
      financialIndicator.year = 2020;
      expect(financialIndicator.year).toBe(2020);

      financialIndicator.year = 2030;
      expect(financialIndicator.year).toBe(2030);

      financialIndicator.year = 1990;
      expect(financialIndicator.year).toBe(1990);
    });

    it("should handle exchange rate values correctly", () => {
      financialIndicator.exchangeRate = 0.5;
      expect(financialIndicator.exchangeRate).toBe(0.5);

      financialIndicator.exchangeRate = 2.0;
      expect(financialIndicator.exchangeRate).toBe(2.0);

      financialIndicator.exchangeRate = null;
      expect(financialIndicator.exchangeRate).toBeNull();
    });

    it("should handle string values correctly", () => {
      financialIndicator.collection = "revenue";
      expect(financialIndicator.collection).toBe("revenue");

      financialIndicator.collection = "expenses";
      expect(financialIndicator.collection).toBe("expenses");

      financialIndicator.description = "Updated description";
      expect(financialIndicator.description).toBe("Updated description");
    });
  });

  describe("Table configuration", () => {
    it("should have correct table name", () => {
      expect(FinancialIndicator.tableName).toBe("financial_indicators");
    });

    it("should have underscored option enabled", () => {
      expect(FinancialIndicator.options?.underscored).toBe(true);
    });

    it("should have paranoid option enabled", () => {
      expect(FinancialIndicator.options?.paranoid).toBe(true);
    });
  });

  describe("Column constraints", () => {
    it("should handle organisationId as unsigned bigint", () => {
      financialIndicator.organisationId = 1;
      expect(financialIndicator.organisationId).toBe(1);

      financialIndicator.organisationId = 999999999;
      expect(financialIndicator.organisationId).toBe(999999999);
    });

    it("should handle year as unsigned smallint", () => {
      financialIndicator.year = 1;
      expect(financialIndicator.year).toBe(1);

      financialIndicator.year = 32767; // Max value for SMALLINT UNSIGNED
      expect(financialIndicator.year).toBe(32767);
    });

    it("should handle amount as decimal with precision", () => {
      financialIndicator.amount = 123456789.12; // 15 digits total, 2 decimal places
      expect(financialIndicator.amount).toBe(123456789.12);

      financialIndicator.amount = 0.01;
      expect(financialIndicator.amount).toBe(0.01);

      financialIndicator.amount = 99999999999999.99;
      expect(financialIndicator.amount).toBe(99999999999999.99);
    });

    it("should handle exchangeRate as decimal with precision", () => {
      financialIndicator.exchangeRate = 0.01;
      expect(financialIndicator.exchangeRate).toBe(0.01);

      financialIndicator.exchangeRate = 99999999999999.99;
      expect(financialIndicator.exchangeRate).toBe(99999999999999.99);
    });
  });

  describe("UUID handling", () => {
    it("should handle UUID format correctly", () => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      financialIndicator.uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(uuidPattern.test(financialIndicator.uuid)).toBe(true);

      financialIndicator.uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      expect(uuidPattern.test(financialIndicator.uuid)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle null values correctly", () => {
      financialIndicator.amount = null;
      financialIndicator.description = null;
      financialIndicator.exchangeRate = null;

      expect(financialIndicator.amount).toBeNull();
      expect(financialIndicator.description).toBeNull();
      expect(financialIndicator.exchangeRate).toBeNull();
    });

    it("should handle empty strings", () => {
      financialIndicator.collection = "";
      financialIndicator.description = "";

      expect(financialIndicator.collection).toBe("");
      expect(financialIndicator.description).toBe("");
    });

    it("should handle zero values", () => {
      financialIndicator.amount = 0;
      financialIndicator.year = 0;
      financialIndicator.exchangeRate = 0;

      expect(financialIndicator.amount).toBe(0);
      expect(financialIndicator.year).toBe(0);
      expect(financialIndicator.exchangeRate).toBe(0);
    });

    it("should handle very large numbers", () => {
      financialIndicator.amount = 99999999999999.99;
      financialIndicator.organisationId = 999999999;

      expect(financialIndicator.amount).toBe(99999999999999.99);
      expect(financialIndicator.organisationId).toBe(999999999);
    });
  });

  describe("Data validation", () => {
    it("should validate collection names", () => {
      const validCollections = ["revenue", "expenses", "assets", "liabilities", "equity"];

      validCollections.forEach(collection => {
        financialIndicator.collection = collection;
        expect(financialIndicator.collection).toBe(collection);
      });
    });

    it("should validate year ranges", () => {
      const validYears = [2000, 2010, 2020, 2030, 2050];

      validYears.forEach(year => {
        financialIndicator.year = year;
        expect(financialIndicator.year).toBe(year);
      });
    });

    it("should validate amount precision", () => {
      financialIndicator.amount = 123.45;
      expect(financialIndicator.amount).toBe(123.45);

      financialIndicator.amount = 123.456; // Should handle precision correctly
      expect(financialIndicator.amount).toBe(123.456);
    });
  });

  describe("Model inheritance", () => {
    it("should extend Model class", () => {
      expect(financialIndicator).toBeInstanceOf(FinancialIndicator);
      expect(financialIndicator).toHaveProperty("id");
      expect(financialIndicator).toHaveProperty("createdAt");
      expect(financialIndicator).toHaveProperty("updatedAt");
    });
  });
});
