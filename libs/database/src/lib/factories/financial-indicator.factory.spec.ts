import { FinancialIndicatorFactory } from "./financial-indicator.factory";
import { OrganisationFactory } from "./index";

// Mock the dependencies
jest.mock("./index", () => ({
  OrganisationFactory: {
    associate: jest.fn()
  }
}));

jest.mock("@faker-js/faker", () => ({
  faker: {
    lorem: {
      slug: jest.fn(),
      sentences: jest.fn()
    },
    number: {
      float: jest.fn()
    }
  }
}));

describe("FinancialIndicatorFactory", () => {
  const mockOrganisationId = 1;
  const mockCollection = "test-collection";
  const mockAmount = 1000.5;
  const mockDescription = "Test financial indicator description";

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    (OrganisationFactory.associate as jest.Mock).mockReturnValue(mockOrganisationId);

    const { faker } = require("@faker-js/faker");
    faker.lorem.slug.mockReturnValue(mockCollection);
    faker.lorem.sentences.mockReturnValue(mockDescription);
    faker.number.float.mockReturnValue(mockAmount);
  });

  describe("Factory definition", () => {
    it("should be defined as a FactoryGirl factory", () => {
      expect(FinancialIndicatorFactory).toBeDefined();
      expect(typeof FinancialIndicatorFactory.build).toBe("function");
    });

    it("should be configured for FinancialIndicator entity", () => {
      expect(FinancialIndicatorFactory).toBeDefined();
    });
  });

  describe("Factory attributes", () => {
    it("should generate organisationId using OrganisationFactory.associate", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(OrganisationFactory.associate).toHaveBeenCalledWith("id");
      expect(financialIndicator.organisationId).toBe(mockOrganisationId);
    });

    it("should generate collection using faker.lorem.slug", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      const { faker } = require("@faker-js/faker");
      expect(faker.lorem.slug).toHaveBeenCalled();
      expect(financialIndicator.collection).toBe(mockCollection);
    });

    it("should generate amount using faker.number.float", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      const { faker } = require("@faker-js/faker");
      expect(faker.number.float).toHaveBeenCalledWith({
        min: 100,
        max: 10000,
        fractionDigits: 2
      });
      expect(financialIndicator.amount).toBe(mockAmount);
    });

    it("should generate description using faker.lorem.sentences", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      const { faker } = require("@faker-js/faker");
      expect(faker.lorem.sentences).toHaveBeenCalled();
      expect(financialIndicator.description).toBe(mockDescription);
    });
  });

  describe("Generated data structure", () => {
    it("should return an object with expected properties", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(financialIndicator).toHaveProperty("organisationId");
      expect(financialIndicator).toHaveProperty("collection");
      expect(financialIndicator).toHaveProperty("amount");
      expect(financialIndicator).toHaveProperty("description");
    });

    it("should have correct data types", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(typeof financialIndicator.organisationId).toBe("number");
      expect(typeof financialIndicator.collection).toBe("string");
      expect(typeof financialIndicator.amount).toBe("number");
      expect(typeof financialIndicator.description).toBe("string");
    });

    it("should have valid value ranges", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(financialIndicator.organisationId).toBeGreaterThan(0);
      expect(financialIndicator.collection.length).toBeGreaterThan(0);
      expect(financialIndicator.amount).toBeGreaterThanOrEqual(100);
      expect(financialIndicator.amount).toBeLessThanOrEqual(10000);
      expect(financialIndicator.description?.length).toBeGreaterThan(0);
    });
  });

  describe("Factory methods", () => {
    it("should have build method", () => {
      expect(typeof FinancialIndicatorFactory.build).toBe("function");
    });

    it("should have create method", () => {
      expect(typeof FinancialIndicatorFactory.create).toBe("function");
    });
  });

  describe("Data consistency", () => {
    it("should generate consistent data within the same call", async () => {
      const financialIndicator1 = await FinancialIndicatorFactory.build();
      const financialIndicator2 = await FinancialIndicatorFactory.build();

      expect(financialIndicator1.organisationId).toBe(financialIndicator2.organisationId);
      expect(financialIndicator1.collection).toBe(financialIndicator2.collection);
      expect(financialIndicator1.amount).toBe(financialIndicator2.amount);
      expect(financialIndicator1.description).toBe(financialIndicator2.description);
    });

    it("should generate different data on subsequent calls", async () => {
      // Mock faker to return different values
      const { faker } = require("@faker-js/faker");
      faker.lorem.slug.mockReturnValueOnce("collection-1").mockReturnValueOnce("collection-2");
      faker.number.float.mockReturnValueOnce(500.25).mockReturnValueOnce(750.75);

      const financialIndicator1 = await FinancialIndicatorFactory.build();
      const financialIndicator2 = await FinancialIndicatorFactory.build();

      expect(financialIndicator1.collection).not.toBe(financialIndicator2.collection);
      expect(financialIndicator1.amount).not.toBe(financialIndicator2.amount);
    });
  });

  describe("Edge cases", () => {
    it("should handle faker returning empty strings", async () => {
      const { faker } = require("@faker-js/faker");
      faker.lorem.slug.mockReturnValue("");
      faker.lorem.sentences.mockReturnValue("");

      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(financialIndicator.collection).toBe("");
      expect(financialIndicator.description).toBe("");
    });

    it("should handle faker returning very large numbers", async () => {
      const { faker } = require("@faker-js/faker");
      faker.number.float.mockReturnValue(9999.99);

      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(financialIndicator.amount).toBe(9999.99);
    });

    it("should handle faker returning very small numbers", async () => {
      const { faker } = require("@faker-js/faker");
      faker.number.float.mockReturnValue(100.0);

      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(financialIndicator.amount).toBe(100.0);
    });
  });

  describe("Integration with OrganisationFactory", () => {
    it("should call OrganisationFactory.associate with correct parameter", async () => {
      await FinancialIndicatorFactory.build();

      expect(OrganisationFactory.associate).toHaveBeenCalledWith("id");
      expect(OrganisationFactory.associate).toHaveBeenCalledTimes(1);
    });

    it("should use the returned organisationId", async () => {
      const mockOrgId = 999;
      (OrganisationFactory.associate as jest.Mock).mockReturnValue(mockOrgId);

      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(financialIndicator.organisationId).toBe(mockOrgId);
    });
  });

  describe("Faker configuration", () => {
    it("should use correct faker methods", async () => {
      await FinancialIndicatorFactory.build();

      const { faker } = require("@faker-js/faker");
      expect(faker.lorem.slug).toHaveBeenCalled();
      expect(faker.lorem.sentences).toHaveBeenCalled();
      expect(faker.number.float).toHaveBeenCalled();
    });

    it("should use correct faker parameters", async () => {
      await FinancialIndicatorFactory.build();

      const { faker } = require("@faker-js/faker");
      expect(faker.number.float).toHaveBeenCalledWith({
        min: 100,
        max: 10000,
        fractionDigits: 2
      });
    });
  });

  describe("Factory validation", () => {
    it("should generate valid organisationId", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(Number.isInteger(financialIndicator.organisationId)).toBe(true);
      expect(financialIndicator.organisationId).toBeGreaterThan(0);
    });

    it("should generate valid collection string", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(typeof financialIndicator.collection).toBe("string");
      expect(financialIndicator.collection.length).toBeGreaterThan(0);
    });

    it("should generate valid amount number", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(typeof financialIndicator.amount).toBe("number");
      expect(Number.isFinite(financialIndicator.amount)).toBe(true);
      expect(financialIndicator.amount).toBeGreaterThanOrEqual(100);
      expect(financialIndicator.amount).toBeLessThanOrEqual(10000);
    });

    it("should generate valid description string", async () => {
      const financialIndicator = await FinancialIndicatorFactory.build();

      expect(typeof financialIndicator.description).toBe("string");
      expect(financialIndicator.description?.length).toBeGreaterThan(0);
    });
  });
});
