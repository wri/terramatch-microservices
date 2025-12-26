import { RelationResourceCollector } from "./index";
import {
  FinancialIndicator,
  FinancialReport,
  Organisation,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import {
  FinancialIndicatorFactory,
  FinancialReportFactory,
  MediaFactory,
  OrganisationFactory
} from "@terramatch-microservices/database/factories";
import { EmbeddedFinancialIndicatorDto } from "../../dto/financial-indicator.dto";
import { orderBy } from "lodash";
import { faker } from "@faker-js/faker";
import { CollectorTestHarness, getRelation } from "../../util/testing";

describe("FinancialIndicatorCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.financialIndicators;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws if both an org and a financial report is provided in a single collection", async () => {
      await expect(
        collector.collect({}, { organisations: new Organisation(), financialReports: new FinancialReport() })
      ).rejects.toThrow("Only one of financialReports or organisations can be set for financialIndicators.");
    });

    it("collects from organisation", async () => {
      collector.addField(getRelation("org-financial-indicators-financial-collection"), "organisations", "one");

      const org = await OrganisationFactory.create({ finStartMonth: 12, currency: "EUR" });
      const indicators = await FinancialIndicatorFactory.org(org).createMany(3);
      await Promise.all(indicators.map(indicator => indicator.reload()));
      await harness.expectAnswers(
        { organisations: org },
        {
          one: orderBy(indicators, "id").map(
            indicator =>
              new EmbeddedFinancialIndicatorDto(indicator, {
                startMonth: org.finStartMonth,
                currency: org.currency,
                documentation: []
              })
          )
        }
      );
    });

    it("collections from financial report", async () => {
      collector.addField(getRelation("fin-rep-financial-indicators-financial-collection"), "financialReports", "one");

      const org = await OrganisationFactory.create({ finStartMonth: 12, currency: "EUR" });
      const report = await FinancialReportFactory.org(org).create({ finStartMonth: 11, currency: "USD" });
      await FinancialReportFactory.org(org).create();
      const indicators = await FinancialIndicatorFactory.report(report).createMany(3);
      await Promise.all(indicators.map(indicator => indicator.reload()));
      const media = await Promise.all(
        indicators.map(indicator =>
          MediaFactory.financialIndicator(indicator).create({ collectionName: "documentation" })
        )
      );
      await harness.expectAnswers(
        { financialReports: report },
        {
          one: orderBy(indicators, "id").map(
            (indicator, index) =>
              new EmbeddedFinancialIndicatorDto(indicator, {
                startMonth: report.finStartMonth,
                currency: report.currency,
                documentation: [expect.objectContaining({ uuid: media[index].uuid })]
              })
          )
        }
      );
    });
  });

  describe("sync", () => {
    it("throws if the model is neither and org nor a financial report", async () => {
      await expect(
        collector.syncRelation(
          new ProjectReport(),
          getRelation("org-financial-indicators-financial-collection"),
          [],
          false
        )
      ).rejects.toThrow("Only orgs and financialReports are supported for financialIndicators");
    });

    describe("orgs", () => {
      it("removes all indicators with an empty answer", async () => {
        const org = await OrganisationFactory.create();
        const indicators = await FinancialIndicatorFactory.org(org).createMany(2);
        await collector.syncRelation(org, getRelation("org-financial-indicators-financial-collection"), [], false);
        await Promise.all(indicators.map(indicator => indicator.reload({ paranoid: false })));
        expect(indicators[0].deletedAt).not.toBeNull();
        expect(indicators[1].deletedAt).not.toBeNull();
      });

      it("updates and creates indicators", async () => {
        const org = await OrganisationFactory.create({ finStartMonth: 12, currency: "EUR" });
        const indicators = await FinancialIndicatorFactory.org(org).createMany(2);
        const description1 = faker.lorem.sentence();
        const description2 = faker.lorem.sentence();
        await collector.syncRelation(
          org,
          getRelation("org-financial-indicators-financial-collection"),
          [
            {
              uuid: indicators[0].uuid,
              amount: 100,
              year: 2020,
              description: description1,
              startMonth: 11,
              currency: "USD"
            },
            { amount: 50, year: 2021, description: description2, startMonth: 11, currency: "USD" }
          ],
          false
        );
        await Promise.all(indicators.map(indicator => indicator.reload({ paranoid: false })));
        await org.reload();
        const allIndicators = await FinancialIndicator.organisation(org.id).findAll();

        expect(indicators[1].deletedAt).not.toBeNull();
        expect(indicators[0]).toMatchObject({ amount: 100, year: 2020, description: description1 });
        expect(allIndicators.length).toBe(2);
        expect(allIndicators.find(({ description }) => description === description2)).toMatchObject({
          amount: 50,
          year: 2021
        });
        expect(org.finStartMonth).toBe(11);
        expect(org.currency).toBe("USD");
      });
    });

    describe("financialReports", () => {
      it("removes all indicators with an empty answer", async () => {
        const org = await OrganisationFactory.create();
        const report = await FinancialReportFactory.org(org).create();
        const indicators = await FinancialIndicatorFactory.report(report).createMany(2);
        await collector.syncRelation(
          report,
          getRelation("fin-rep-financial-indicators-financial-collection"),
          [],
          false
        );
        await Promise.all(indicators.map(indicator => indicator.reload({ paranoid: false })));
        expect(indicators[0].deletedAt).not.toBeNull();
        expect(indicators[1].deletedAt).not.toBeNull();
      });

      it("updates and creates indicators", async () => {
        const org = await OrganisationFactory.create({ finStartMonth: 12, currency: "EUR" });
        const orgIndicators = await FinancialIndicatorFactory.org(org).createMany(2);
        const report = await FinancialReportFactory.org(org).create({ finStartMonth: 11, currency: "USD" });
        const reportIndicators = await FinancialIndicatorFactory.report(report).createMany(2);
        const description1 = faker.lorem.sentence();
        const description2 = faker.lorem.sentence();
        await collector.syncRelation(
          report,
          getRelation("fin-rep-financial-indicators-financial-collection"),
          [
            {
              uuid: reportIndicators[0].uuid,
              amount: 100,
              year: 2020,
              description: description1,
              startMonth: 10,
              currency: "YEN"
            },
            { amount: 50, year: 2021, description: description2, startMonth: 11, currency: "USD" }
          ],
          false
        );
        await Promise.all(
          [...orgIndicators, ...reportIndicators].map(indicator => indicator.reload({ paranoid: false }))
        );
        await org.reload();
        await report.reload();
        const allIndicators = await FinancialIndicator.financialReport(report.id).findAll();

        expect(orgIndicators[0].deletedAt).toBeNull();
        expect(orgIndicators[1].deletedAt).toBeNull();
        expect(reportIndicators[1].deletedAt).not.toBeNull();
        expect(reportIndicators[0]).toMatchObject({ amount: 100, year: 2020, description: description1 });
        expect(allIndicators.length).toBe(2);
        expect(allIndicators.find(({ description }) => description === description2)).toMatchObject({
          amount: 50,
          year: 2021
        });
        expect(org.finStartMonth).toBe(12);
        expect(org.currency).toBe("EUR");
        expect(report.finStartMonth).toBe(10);
        expect(report.currency).toBe("YEN");
      });
    });
  });
});
