import { CollectorTestHarness, getRelation } from "./linked-answer-collector.spec";
import { RelationResourceCollector } from "./index";
import { FinancialReport, FundingType, Organisation, ProjectReport } from "@terramatch-microservices/database/entities";
import {
  FinancialReportFactory,
  FundingTypeFactory,
  OrganisationFactory
} from "@terramatch-microservices/database/factories";
import { EmbeddedFundingTypeDto } from "../../dto/funding-type.dto";
import { orderBy } from "lodash";

describe("FundingTypeCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.fundingTypes;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws if both an org and a financial report is provided in a single collection", async () => {
      await expect(
        collector.collect({}, { organisations: new Organisation(), financialReports: new FinancialReport() })
      ).rejects.toThrow("Only one of financialReports or organisations can be set for fundingTypes.");
    });

    it("collects from organisation", async () => {
      collector.addField(getRelation("org-funding-types"), "organisations", "one");

      const org = await OrganisationFactory.create();
      const fundingTypes = await FundingTypeFactory.org(org).createMany(2);
      await harness.expectAnswers(
        { organisations: org },
        { one: orderBy(fundingTypes, "id").map(fundingType => new EmbeddedFundingTypeDto(fundingType)) }
      );
    });

    it("collects from financial reports", async () => {
      collector.addField(getRelation("fin-rep-funding-types"), "financialReports", "one");

      const report = await FinancialReportFactory.org().create();
      const fundingTypes = await FundingTypeFactory.report(report).createMany(2);
      await harness.expectAnswers(
        { financialReports: report },
        { one: orderBy(fundingTypes, "id").map(fundingType => new EmbeddedFundingTypeDto(fundingType)) }
      );
    });
  });

  describe("sync", () => {
    it("throws if a model is neither and org nor a financial report", async () => {
      await expect(
        collector.syncRelation(new ProjectReport(), getRelation("org-funding-types"), [], false)
      ).rejects.toThrow("Only orgs and financialReports are supported for fundingTypes");
    });

    it("throws if an org UUID cannot be found", async () => {
      const org = await OrganisationFactory.create();
      const report = await FinancialReportFactory.org(org).create();
      await org.destroy();
      await expect(collector.syncRelation(report, getRelation("fin-rep-funding-types"), [], false)).rejects.toThrow(
        "Organisation not found for fundingTypes"
      );
    });

    it("destroys all funding types with an empty answer", async () => {
      const org = await OrganisationFactory.create();
      const fundingTypes = await FundingTypeFactory.org(org).createMany(2);
      await collector.syncRelation(org, getRelation("org-funding-types"), [], false);
      await Promise.all(fundingTypes.map(fundingType => fundingType.reload({ paranoid: false })));
      expect(fundingTypes[0].deletedAt).not.toBeNull();
      expect(fundingTypes[1].deletedAt).not.toBeNull();
    });

    it("syncs org funding types", async () => {
      const org = await OrganisationFactory.create();
      const fundingTypes = await FundingTypeFactory.org(org).createMany(3);
      await collector.syncRelation(
        org,
        getRelation("org-funding-types"),
        [
          { uuid: fundingTypes[0].uuid, year: 1952, type: "grant", source: "PPC", amount: 50000 },
          // Matching on year, type and source should prevent deletion
          { year: fundingTypes[1].year, type: fundingTypes[1].type, source: fundingTypes[1].source, amount: 500 },
          { year: 1953, type: "donation", source: "Republic", amount: 20000 },
          // With a missing property, it should be ignored
          { type: "investment", amount: 1 }
        ],
        false
      );
      await Promise.all(fundingTypes.map(fundingType => fundingType.reload({ paranoid: false })));
      const allFundingTypes = await FundingType.organisationByUuid(org.uuid).findAll();

      expect(fundingTypes[2].deletedAt).not.toBeNull();
      expect(fundingTypes[0]).toMatchObject({ year: 1952, type: "grant", source: "PPC", amount: 50000 });
      expect(fundingTypes[1]).toMatchObject({ amount: 500 });
      expect(allFundingTypes.length).toBe(3);
      expect(allFundingTypes.find(({ year }) => year === 1953)).toMatchObject({
        type: "donation",
        source: "Republic",
        amount: 20000
      });
    });

    it("syncs report funding types", async () => {
      const org = await OrganisationFactory.create();
      const orgFundingTypes = await FundingTypeFactory.org(org).createMany(2);
      const report = await FinancialReportFactory.org(org).create();
      const reportFundingTypes = await FundingTypeFactory.report(report).createMany(3);
      await collector.syncRelation(
        report,
        getRelation("fin-rep-funding-types"),
        [
          { uuid: reportFundingTypes[0].uuid, year: 1952, type: "grant", source: "PPC", amount: 50000 },
          // Matching on year, type and source should prevent deletion
          {
            year: reportFundingTypes[1].year,
            type: reportFundingTypes[1].type,
            source: reportFundingTypes[1].source,
            amount: 500
          },
          { year: 1953, type: "donation", source: "Republic", amount: 20000 },
          // With a missing property, it should be ignored
          { type: "investment", amount: 1 }
        ],
        false
      );
      await Promise.all(
        [...orgFundingTypes, ...reportFundingTypes].map(fundingType => fundingType.reload({ paranoid: false }))
      );
      const allFundingTypes = await FundingType.financialReport(report.id).findAll();

      expect(orgFundingTypes[0].deletedAt).toBeNull();
      expect(orgFundingTypes[1].deletedAt).toBeNull();
      expect(reportFundingTypes[2].deletedAt).not.toBeNull();
      expect(reportFundingTypes[0]).toMatchObject({ year: 1952, type: "grant", source: "PPC", amount: 50000 });
      expect(reportFundingTypes[1]).toMatchObject({ amount: 500 });
      expect(allFundingTypes.length).toBe(3);
      expect(allFundingTypes.find(({ year }) => year === 1953)).toMatchObject({
        type: "donation",
        source: "Republic",
        amount: 20000
      });
    });
  });
});
