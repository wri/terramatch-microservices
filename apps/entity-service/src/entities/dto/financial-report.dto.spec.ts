import { FinancialReportLightDto, FinancialReportFullDto } from "./financial-report.dto";
import { FinancialReport } from "@terramatch-microservices/database/entities";
import { FinancialIndicatorDto } from "./financial-indicator.dto";
import { OrganisationStatus } from "@terramatch-microservices/database/constants/status";

describe("FinancialReportDto", () => {
  let mockFinancialReport: FinancialReport;

  // Define specific types instead of any
  type MockMedia = {
    id: number;
    uuid: string;
    name: string;
    url: string;
    collectionName: string;
    createdAt: Date;
    updatedAt: Date;
  };

  type MockFinancialIndicator = {
    id: number;
    uuid: string;
    collection: string;
    description: string;
    amount: number;
    exchangeRate: number;
    year: number;
    documentation: MockMedia[];
    createdAt: Date;
    updatedAt: Date;
  };

  let mockFinancialIndicators: MockFinancialIndicator[];
  let mockMedia: MockMedia[];

  // Helper function to create valid props for FinancialReportLightDto
  const createLightProps = () => ({
    documentation: [],
    entityType: "financialReports" as const,
    entityUuid: mockFinancialReport.uuid
  });

  // Helper function to create valid props for FinancialReportFullDto
  const createFullProps = () => ({
    documentation: [],
    entityType: "financialReports" as const,
    entityUuid: mockFinancialReport.uuid,
    fundingTypes: [],
    financialCollection: []
  });

  // Define specific types for status values
  type ReportStatus = "started" | "approved" | "due" | "awaiting-approval" | "needs-more-information";
  type UpdateRequestStatus = "draft" | "approved" | "awaiting-approval" | "needs-more-information" | "no-update";

  beforeEach(() => {
    mockMedia = [
      {
        id: 1,
        uuid: "media-uuid-1",
        name: "test-document.pdf",
        url: "https://example.com/test-document.pdf",
        collectionName: "documentation",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockFinancialIndicators = [
      {
        id: 1,
        uuid: "indicator-uuid-1",
        collection: "revenue",
        description: "Test revenue indicator",
        amount: 10000.5,
        exchangeRate: 1.0,
        year: 2023,
        documentation: mockMedia,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockFinancialReport = {
      id: 1,
      uuid: "report-uuid-1",
      status: "started",
      organisationId: 1,
      title: "Test Financial Report 2023",
      yearOfReport: 2023,
      updateRequestStatus: "draft",
      nothingToReport: false,
      approvedAt: null,
      approvedBy: 1,
      createdBy: 1,
      submittedAt: null,
      frameworkKey: "terrafund",
      dueAt: new Date("2023-12-31"),
      completion: 75,
      feedback: "Good progress, needs more details",
      feedbackFields: ["revenue", "expenses"],
      answers: "Sample answers for financial questions",
      finStartMonth: 1,
      currency: "USD",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-15"),
      deletedAt: null,
      organisation: {
        id: 1,
        uuid: "org-uuid-1",
        name: "Test Organisation",
        type: "test-type",
        status: "active" as OrganisationStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      financialIndicators: mockFinancialIndicators
    } as unknown as FinancialReport;
  });

  describe("FinancialReportLightDto", () => {
    let lightDto: FinancialReportLightDto;

    beforeEach(() => {
      lightDto = new FinancialReportLightDto(mockFinancialReport, createLightProps());
    });

    it("should create light DTO with basic properties", () => {
      expect(lightDto.status).toBe("draft");
      expect(lightDto.organisationName).toBe("Test Organisation");
      expect(lightDto.yearOfReport).toBe(2023);
      expect(lightDto.submittedAt).toBeNull();
      expect(lightDto.createdAt).toEqual(new Date("2023-01-01"));
      expect(lightDto.updatedAt).toEqual(new Date("2023-01-15"));
    });

    it("should not include full properties in light DTO", () => {
      expect(lightDto).not.toHaveProperty("title");
      expect(lightDto).not.toHaveProperty("approvedAt");
      expect(lightDto).not.toHaveProperty("completion");
      expect(lightDto).not.toHaveProperty("dueAt");
      expect(lightDto).not.toHaveProperty("updateRequestStatus");
      expect(lightDto).not.toHaveProperty("frameworkKey");
      expect(lightDto).not.toHaveProperty("nothingToReport");
      expect(lightDto).not.toHaveProperty("feedback");
      expect(lightDto).not.toHaveProperty("feedbackFields");
      expect(lightDto).not.toHaveProperty("answers");
      expect(lightDto).not.toHaveProperty("finStartMonth");
      expect(lightDto).not.toHaveProperty("currency");
      expect(lightDto).not.toHaveProperty("organisationUuid");
      expect(lightDto).not.toHaveProperty("organisationType");
      expect(lightDto).not.toHaveProperty("organisationStatus");
      expect(lightDto).not.toHaveProperty("financialCollection");
    });

    it("should handle null values correctly", () => {
      mockFinancialReport.organisation.name = null;
      mockFinancialReport.yearOfReport = null;
      mockFinancialReport.submittedAt = null;

      const dto = new FinancialReportLightDto(mockFinancialReport, {
        lightResource: true,
        includeAssociations: false
      });

      expect(dto.organisationName).toBeNull();
      expect(dto.yearOfReport).toBeNull();
      expect(dto.submittedAt).toBeNull();
    });

    it("should handle null values correctly", () => {
      mockFinancialReport.organisation.name = null;
      mockFinancialReport.yearOfReport = null;

      const dto = new FinancialReportLightDto(mockFinancialReport, {
        lightResource: true,
        includeAssociations: false
      });

      expect(dto.organisationName).toBeNull();
      expect(dto.yearOfReport).toBeNull();
    });
  });

  describe("FinancialReportFullDto", () => {
    let fullDto: FinancialReportFullDto;

    beforeEach(() => {
      fullDto = new FinancialReportFullDto(mockFinancialReport, createFullProps());
    });

    it("should create full DTO with all properties", () => {
      expect(fullDto.status).toBe("draft");
      expect(fullDto.organisationName).toBe("Test Organisation");
      expect(fullDto.yearOfReport).toBe(2023);
      expect(fullDto.submittedAt).toBeNull();
      expect(fullDto.createdAt).toEqual(new Date("2023-01-01"));
      expect(fullDto.updatedAt).toEqual(new Date("2023-01-15"));
      expect(fullDto.title).toBe("Test Financial Report 2023");
      expect(fullDto.approvedAt).toBeNull();
      expect(fullDto.completion).toBe(75);
      expect(fullDto.dueAt).toEqual(new Date("2023-12-31"));
      expect(fullDto.updateRequestStatus).toBe("pending");
      expect(fullDto.frameworkKey).toBe("test-framework");
      expect(fullDto.nothingToReport).toBe(false);
      expect(fullDto.feedback).toBe("Good progress, needs more details");
      expect(fullDto.feedbackFields).toEqual(["revenue", "expenses"]);
      expect(fullDto.answers).toBe("Sample answers for financial questions");
      expect(fullDto.finStartMonth).toBe(1);
      expect(fullDto.currency).toBe("USD");
      expect(fullDto.organisationUuid).toBe("org-uuid-1");
      expect(fullDto.organisationType).toBe("test-type");
      expect(fullDto.organisationStatus).toBe("active");
    });

    it("should include financial collection", () => {
      expect(fullDto.financialCollection).toBeDefined();
      expect(fullDto.financialCollection).toHaveLength(1);
      expect(fullDto.financialCollection?.[0]).toBeInstanceOf(FinancialIndicatorDto);
    });

    it("should handle null values in full DTO", () => {
      mockFinancialReport.title = null;
      mockFinancialReport.approvedAt = null;
      mockFinancialReport.completion = 0;
      mockFinancialReport.feedback = null;
      mockFinancialReport.financialIndicators = null;

      const dto = new FinancialReportFullDto(mockFinancialReport, createFullProps());

      expect(dto.title).toBeNull();
      expect(dto.approvedAt).toBeNull();
      expect(dto.completion).toBeNull();
      expect(dto.feedback).toBeNull();
      expect(dto.financialCollection).toBeNull();
    });

    it("should handle empty arrays", () => {
      mockFinancialReport.feedbackFields = [];
      mockFinancialReport.financialIndicators = [];

      const dto = new FinancialReportFullDto(mockFinancialReport, createFullProps());

      expect(dto.feedbackFields).toEqual([]);
      expect(dto.financialCollection).toEqual([]);
    });

    it("should handle boolean values correctly", () => {
      mockFinancialReport.nothingToReport = true;
      mockFinancialReport.nothingToReport = false;

      const dto = new FinancialReportFullDto(mockFinancialReport, createFullProps());

      expect(dto.nothingToReport).toBe(false);
    });

    it("should handle numeric values correctly", () => {
      mockFinancialReport.yearOfReport = 2024;
      mockFinancialReport.completion = 100;
      mockFinancialReport.finStartMonth = 12;

      const dto = new FinancialReportFullDto(mockFinancialReport, createFullProps());

      expect(dto.yearOfReport).toBe(2024);
      expect(dto.completion).toBe(100);
      expect(dto.finStartMonth).toBe(12);
    });

    it("should handle date values correctly", () => {
      const testDate = new Date("2023-06-15");
      mockFinancialReport.submittedAt = testDate;
      mockFinancialReport.approvedAt = testDate;

      const dto = new FinancialReportFullDto(mockFinancialReport, createFullProps());

      expect(dto.submittedAt).toEqual(testDate);
      expect(dto.approvedAt).toEqual(testDate);
    });
  });

  describe("DTO inheritance", () => {
    it("should extend EntityDto", () => {
      const lightDto = new FinancialReportLightDto(mockFinancialReport, createLightProps());

      expect(lightDto).toHaveProperty("id");
      expect(lightDto).toHaveProperty("uuid");
    });

    it("should have JsonApiDto decorator", () => {
      const lightDto = new FinancialReportLightDto(mockFinancialReport, createLightProps());

      expect(lightDto.constructor.name).toBe("FinancialReportLightDto");
    });
  });

  describe("Edge cases", () => {
    it("should handle missing organisation data", () => {
      const reportWithoutOrg = {
        ...mockFinancialReport,
        organisation: undefined
      } as unknown as FinancialReport;

      const lightDto = new FinancialReportLightDto(reportWithoutOrg, createLightProps());

      expect(lightDto.organisationName).toBeUndefined();
    });

    it("should handle missing financial collection", () => {
      mockFinancialReport.financialIndicators = null;

      const fullDto = new FinancialReportFullDto(mockFinancialReport, createFullProps());

      expect(fullDto.financialCollection).toBeNull();
    });

    it("should handle undefined props parameter", () => {
      const lightDto = new FinancialReportLightDto(mockFinancialReport, undefined);
      expect(lightDto).toBeDefined();
    });

    it("should handle undefined financialReport parameter", () => {
      const lightDto = new FinancialReportLightDto(undefined, createLightProps());
      expect(lightDto).toBeDefined();
    });
  });

  describe("Data transformation", () => {
    it("should transform status correctly", () => {
      const statuses = ["started", "approved", "due", "awaiting-approval", "needs-more-information"];

      statuses.forEach(status => {
        mockFinancialReport.status = status as ReportStatus;
        const dto = new FinancialReportLightDto(mockFinancialReport, createLightProps());
        expect(dto.status).toBe(status);
      });
    });

    it("should transform updateRequestStatus correctly", () => {
      const statuses = ["draft", "approved", "awaiting-approval", "needs-more-information", "no-update"];

      statuses.forEach(status => {
        mockFinancialReport.updateRequestStatus = status as UpdateRequestStatus;
        const dto = new FinancialReportFullDto(mockFinancialReport, createFullProps());
        expect(dto.updateRequestStatus).toBe(status);
      });
    });

    it("should transform frameworkKey correctly", () => {
      const keys = ["terrafund", "terrafund-landscapes", "enterprises"] as const;

      keys.forEach(key => {
        const reportWithKey = { ...mockFinancialReport, frameworkKey: key } as unknown as FinancialReport;
        const dto = new FinancialReportFullDto(reportWithKey, createFullProps());
        expect(dto.frameworkKey).toBe(key);
      });
    });
  });
});
