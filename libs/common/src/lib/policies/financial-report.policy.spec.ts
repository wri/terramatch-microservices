import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { FinancialReportPolicy } from "./financial-report.policy";
import { FinancialReport } from "@terramatch-microservices/database/entities";

describe("FinancialReportPolicy", () => {
  let policy: FinancialReportPolicy;
  let builder: AbilityBuilder<any>;

  beforeEach(() => {
    builder = new AbilityBuilder(createMongoAbility);
    policy = new FinancialReportPolicy(1, [], builder);
  });

  describe("addRules", () => {
    it("should allow super admin users to manage all financial reports", async () => {
      const ability = builder.build();
      expect(ability.can("read", FinancialReport)).toBe(true);
      expect(ability.can("update", FinancialReport)).toBe(true);
      expect(ability.can("approve", FinancialReport)).toBe(true);
      expect(ability.can("delete", FinancialReport)).toBe(true);
      expect(ability.can("uploadFiles", FinancialReport)).toBe(true);
    });

    it("should allow dashboard users to read all financial reports", async () => {
      policy = new FinancialReportPolicy(1, ["view-dashboard"], builder);
      await policy.addRules();

      const ability = builder.build();
      expect(ability.can("read", FinancialReport)).toBe(true);
    });

    it("should allow framework users to manage financial reports within their framework", async () => {
      policy = new FinancialReportPolicy(1, ["framework-test-framework"], builder);
      await policy.addRules();

      const ability = builder.build();
      expect(ability.can("read", FinancialReport)).toBe(true);
      expect(ability.can("update", FinancialReport)).toBe(true);
      expect(ability.can("approve", FinancialReport)).toBe(true);
    });

    it("should allow users with manage-own to read and update their organisation's financial reports", async () => {
      policy = new FinancialReportPolicy(1, ["manage-own"], builder);
      await policy.addRules();

      const ability = builder.build();
      expect(ability.can("read", FinancialReport)).toBe(true);
      expect(ability.can("update", FinancialReport)).toBe(true);
    });

    it("should allow users with financial-reports-manage to manage all financial reports", async () => {
      policy = new FinancialReportPolicy(1, ["financial-reports-manage"], builder);
      await policy.addRules();

      const ability = builder.build();
      expect(ability.can("read", FinancialReport)).toBe(true);
      expect(ability.can("update", FinancialReport)).toBe(true);
      expect(ability.can("approve", FinancialReport)).toBe(true);
      expect(ability.can("delete", FinancialReport)).toBe(true);
    });
  });
});
