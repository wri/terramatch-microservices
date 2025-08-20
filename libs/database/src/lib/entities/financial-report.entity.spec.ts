import { FinancialReport } from "./financial-report.entity";
import { User } from "./user.entity";
import { Organisation } from "./organisation.entity";
import { FinancialIndicator } from "./financial-indicator.entity";
import { ReportStatus, UpdateRequestStatus } from "../constants/status";
import { FrameworkKey } from "../constants";

describe("FinancialReport", () => {
  let financialReport: FinancialReport;
  let mockUser: User;
  let mockOrganisation: Organisation;
  let mockFinancialIndicators: FinancialIndicator[];

  beforeEach(() => {
    mockUser = {
      id: 1,
      uuid: "user-uuid-1",
      firstName: "Test",
      lastName: "User",
      emailAddress: "test@example.com",
      organisationId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Partial<User> as User;

    mockOrganisation = {
      id: 1,
      uuid: "org-uuid-1",
      name: "Test Organisation",
      type: "test-type",
      status: "approved" as const,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Partial<Organisation> as Organisation;

    mockFinancialIndicators = [
      {
        id: 1,
        uuid: "indicator-uuid-1",
        organisationId: 1,
        year: 2023,
        collection: "test-collection",
        amount: 1000.5,
        description: "Test indicator",
        exchangeRate: 1.0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as FinancialIndicator
    ];

    financialReport = new FinancialReport();
    financialReport.id = 1;
    financialReport.uuid = "report-uuid-1";
    financialReport.status = "due" as ReportStatus;
    financialReport.organisationId = 1;
    financialReport.title = "Test Financial Report";
    financialReport.yearOfReport = 2023;
    financialReport.updateRequestStatus = "draft" as UpdateRequestStatus;
    financialReport.nothingToReport = false;
    financialReport.approvedAt = null;
    financialReport.approvedBy = 1;
    financialReport.createdBy = 1;
    financialReport.submittedAt = null;
    financialReport.frameworkKey = "terrafund" as FrameworkKey;
    financialReport.dueAt = new Date("2023-12-31");
    financialReport.completion = 75;
    financialReport.feedback = "Good progress";
    financialReport.feedbackFields = ["field1", "field2"];
    financialReport.answers = "Sample answers";
    financialReport.finStartMonth = 1;
    financialReport.currency = "USD";
    financialReport.createdAt = new Date();
    financialReport.updatedAt = new Date();
    financialReport.deletedAt = null;
    financialReport.createdByUser = mockUser;
    financialReport.approvedByUser = null;
    financialReport.organisation = mockOrganisation;
    financialReport.financialCollection = mockFinancialIndicators;
  });

  describe("Static properties", () => {
    it("should have correct LARAVEL_TYPE", () => {
      expect(FinancialReport.LARAVEL_TYPE).toBe("App\\Models\\V2\\FinancialReport");
    });

    it("should have organisation scope method", () => {
      expect(typeof FinancialReport.organisation).toBe("function");
    });
  });

  describe("Instance properties", () => {
    it("should have all required properties", () => {
      expect(financialReport.id).toBe(1);
      expect(financialReport.uuid).toBe("report-uuid-1");
      expect(financialReport.status).toBe("due");
      expect(financialReport.organisationId).toBe(1);
      expect(financialReport.title).toBe("Test Financial Report");
      expect(financialReport.yearOfReport).toBe(2023);
      expect(financialReport.updateRequestStatus).toBe("draft");
      expect(financialReport.nothingToReport).toBe(false);
      expect(financialReport.approvedBy).toBe(1);
      expect(financialReport.createdBy).toBe(1);
      expect(financialReport.frameworkKey).toBe("terrafund");
      expect(financialReport.dueAt).toEqual(new Date("2023-12-31"));
      expect(financialReport.completion).toBe(75);
      expect(financialReport.feedback).toBe("Good progress");
      expect(financialReport.feedbackFields).toEqual(["field1", "field2"]);
      expect(financialReport.answers).toBe("Sample answers");
      expect(financialReport.finStartMonth).toBe(1);
      expect(financialReport.currency).toBe("USD");
    });

    it("should have nullable properties", () => {
      expect(financialReport.approvedAt).toBeNull();
      financialReport.approvedAt = new Date();
      expect(financialReport.approvedAt).toBeInstanceOf(Date);
    });

    it("should have timestamps", () => {
      expect(financialReport.createdAt).toBeInstanceOf(Date);
      expect(financialReport.updatedAt).toBeInstanceOf(Date);
      expect(financialReport.deletedAt).toBeNull();
    });
  });

  describe("Associations", () => {
    it("should have createdByUser association", () => {
      expect(financialReport.createdByUser).toBeDefined();
      expect(financialReport.createdByUser?.id).toBe(1);
      expect(financialReport.createdByUser?.firstName).toBe("Test");
    });

    it("should have approvedByUser association", () => {
      expect(financialReport.approvedByUser).toBeNull();
      financialReport.approvedByUser = mockUser;
      expect(financialReport.approvedByUser?.id).toBe(1);
    });

    it("should have organisation association", () => {
      expect(financialReport.organisation).toBeDefined();
      expect(financialReport.organisation.id).toBe(1);
      expect(financialReport.organisation.name).toBe("Test Organisation");
    });

    it("should have financialCollection association", () => {
      expect(financialReport.financialCollection).toBeDefined();
      expect(financialReport.financialCollection).toHaveLength(1);
      expect(financialReport.financialCollection?.[0].id).toBe(1);
    });
  });

  describe("Getter methods", () => {
    it("should return organisation name", () => {
      expect(financialReport.organisationName).toBe("Test Organisation");
    });

    it("should return organisation uuid", () => {
      expect(financialReport.organisationUuid).toBe("org-uuid-1");
    });

    it("should return organisation type", () => {
      expect(financialReport.organisationType).toBe("test-type");
    });

    it("should return organisation status", () => {
      expect(financialReport.organisationStatus).toBe("approved");
    });

    it("should check if report is completable", () => {
      expect(financialReport.isCompletable).toBe(true);

      financialReport.status = "started" as ReportStatus;
      expect(financialReport.isCompletable).toBe(false);
    });

    it("should check if report is complete", () => {
      expect(financialReport.isComplete).toBe(false);

      financialReport.status = "approved" as ReportStatus;
      expect(financialReport.isComplete).toBe(true);
    });
  });

  describe("Table configuration", () => {
    it("should have correct table name", () => {
      expect(FinancialReport.tableName).toBe("financial_reports");
    });

    it("should have underscored option enabled", () => {
      expect(FinancialReport.options?.underscored).toBe(true);
    });

    it("should have paranoid option enabled", () => {
      expect(FinancialReport.options?.paranoid).toBe(true);
    });

    it("should have hooks configured", () => {
      expect(FinancialReport.options?.hooks).toBeDefined();
      expect(FinancialReport.options?.hooks?.afterCreate).toBeDefined();
    });
  });

  describe("Scopes", () => {
    it("should have organisation scope", () => {
      const scope = FinancialReport.organisation(1);
      expect(scope).toBeDefined();
    });
  });

  describe("Data validation", () => {
    it("should handle valid status values", () => {
      const validStatuses: ReportStatus[] = [
        "due",
        "started",
        "awaiting-approval",
        "approved",
        "needs-more-information"
      ];
      validStatuses.forEach(status => {
        financialReport.status = status;
        expect(financialReport.status).toBe(status);
      });
    });

    it("should handle valid update request status values", () => {
      const validStatuses: UpdateRequestStatus[] = [
        "no-update",
        "draft",
        "awaiting-approval",
        "approved",
        "needs-more-information"
      ];
      validStatuses.forEach(status => {
        financialReport.updateRequestStatus = status;
        expect(financialReport.updateRequestStatus).toBe(status);
      });
    });

    it("should handle valid framework keys", () => {
      const validKeys: FrameworkKey[] = [
        "terrafund",
        "terrafund-landscapes",
        "enterprises",
        "epa-ghana-pilot",
        "ppc",
        "hbf",
        "fundo-flora"
      ];
      validKeys.forEach(key => {
        financialReport.frameworkKey = key;
        expect(financialReport.frameworkKey).toBe(key);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle null values correctly", () => {
      financialReport.title = null;
      financialReport.yearOfReport = null;
      financialReport.feedback = null;

      expect(financialReport.title).toBeNull();
      expect(financialReport.yearOfReport).toBeNull();
      expect(financialReport.feedback).toBeNull();
    });

    it("should handle empty arrays", () => {
      financialReport.feedbackFields = [];
      expect(financialReport.feedbackFields).toEqual([]);
    });

    it("should handle zero values", () => {
      financialReport.completion = 0;
      financialReport.finStartMonth = 0;
      expect(financialReport.completion).toBe(0);
      expect(financialReport.finStartMonth).toBe(0);
    });
  });
});
