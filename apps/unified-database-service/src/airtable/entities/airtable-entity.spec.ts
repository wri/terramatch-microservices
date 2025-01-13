import { airtableColumnName, AirtableEntity, ColumnMapping } from "./airtable-entity";
import { faker } from "@faker-js/faker";
import { Application, Nursery, NurseryReport, Site, SiteReport } from "@terramatch-microservices/database/entities";
import {
  ApplicationFactory,
  FormSubmissionFactory,
  FundingProgrammeFactory,
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  SiteFactory,
  SiteReportFactory
} from "@terramatch-microservices/database/factories";
import Airtable from "airtable";
import { ApplicationEntity, NurseryEntity, NurseryReportEntity, SiteEntity, SiteReportEntity } from "./";
import { orderBy, sortBy } from "lodash";
import { Model } from "sequelize-typescript";

const airtableUpdate = jest.fn<Promise<unknown>, [{ fields: object }[], object]>(() => Promise.resolve());
const Base = jest.fn(() => ({ update: airtableUpdate })) as unknown as Airtable.Base;

const mapEntityColumns = jest.fn(() => Promise.resolve({}));
export class StubEntity extends AirtableEntity<Site> {
  readonly TABLE_NAME = "stubs";
  readonly COLUMNS = ["id"] as ColumnMapping<Site>[];
  readonly MODEL = Site;

  protected getPageFindOptions = (page: number) => ({
    ...super.getPageFindOptions(page),
    limit: 1
  });

  protected mapEntityColumns = mapEntityColumns;
}

async function testAirtableUpdates<M extends Model<M>, A>(
  entity: AirtableEntity<M, A>,
  records: M[],
  spotCheckFields: (record: M) => { fields: object }
) {
  await entity.updateBase(Base);

  const batches = [];
  for (let ii = 0; ii < Math.ceil(records.length / 10); ii++) {
    batches.push(sortBy(records.slice(ii * 10, (ii + 1) * 10), ["uuid"]));
  }

  expect(airtableUpdate).toHaveBeenCalledTimes(batches.length);

  const columnsExpected = entity.COLUMNS.map(airtableColumnName).sort();
  for (let ii = 0; ii < batches.length; ii++) {
    const batch = batches[ii];
    const updates = sortBy(airtableUpdate.mock.calls[ii][0], ["fields.uuid"]);
    expect(updates).toMatchObject(batch.map(spotCheckFields));

    for (const update of updates) {
      expect(Object.keys(update.fields).sort()).toEqual(columnsExpected);
    }
  }
}

// This spec only tests the error cases. The individual entity tests cover everything else.
describe("AirtableEntity", () => {
  afterEach(async () => {
    airtableUpdate.mockClear();
  });

  describe("BaseClass", () => {
    beforeAll(async () => {
      // Ensure there's at least one site so the mapping happens
      await SiteFactory.create();
    });

    it("re-raises mapping errors", async () => {
      mapEntityColumns.mockRejectedValue(new Error("mapping error"));
      await expect(new StubEntity().updateBase(null)).rejects.toThrow("mapping error");
      mapEntityColumns.mockReset();
    });

    it("re-raises airtable errors", async () => {
      airtableUpdate.mockRejectedValue(new Error("airtable error"));
      await expect(new StubEntity().updateBase(Base)).rejects.toThrow("airtable error");
      airtableUpdate.mockReset();
    });
  });

  describe("ApplicationEntity", () => {
    let fundingProgrammeNames: Record<string, string>;
    let applications: Application[];
    let submissionStatuses: Record<string, string>;

    beforeAll(async () => {
      await Application.truncate();

      const org = await OrganisationFactory.create({});
      const fundingProgrammes = await FundingProgrammeFactory.createMany(3);
      fundingProgrammeNames = fundingProgrammes.reduce((names, { uuid, name }) => ({ ...names, [uuid]: name }), {});
      const allApplications = [];
      for (let ii = 0; ii < 15; ii++) {
        allApplications.push(
          await ApplicationFactory.create({
            organisationUuid: org.uuid,
            // test one not having an attached funding programme
            fundingProgrammeUuid: ii === 4 ? null : faker.helpers.arrayElement(Object.keys(fundingProgrammeNames))
          })
        );
      }

      await allApplications[3].destroy();
      await allApplications[11].destroy();
      applications = allApplications.filter(application => !application.isSoftDeleted());

      let first = true;
      submissionStatuses = {};
      for (const { id, uuid } of applications) {
        // skip for the first one so we test an export that's missing a submission
        if (first) {
          first = false;
          continue;
        }

        const submissions = await FormSubmissionFactory.createMany(faker.number.int({ min: 1, max: 5 }), {
          applicationId: id
        });
        submissionStatuses[uuid] = orderBy(submissions, ["id"], ["desc"])[0].status;
      }
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(
        new ApplicationEntity(),
        applications,
        ({ uuid, organisationUuid, fundingProgrammeUuid }) => ({
          fields: {
            uuid,
            organisationUuid,
            fundingProgrammeName: fundingProgrammeNames[fundingProgrammeUuid],
            status: submissionStatuses[uuid]
          }
        })
      );
    });
  });

  describe("NurseryEntity", () => {
    let projectUuids: Record<number, string>;
    let nurseries: Nursery[];

    beforeAll(async () => {
      await Nursery.truncate();

      const projects = await ProjectFactory.createMany(2);
      projectUuids = projects.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      const projectIds = projects.reduce((ids, { id }) => [...ids, id], [] as number[]);
      const allNurseries = [];
      for (let ii = 0; ii < 15; ii++) {
        allNurseries.push(await NurseryFactory.create({ projectId: faker.helpers.arrayElement(projectIds) }));
      }
      allNurseries.push(await NurseryFactory.create({ projectId: null }));

      await allNurseries[2].destroy();
      nurseries = allNurseries.filter(nursery => !nursery.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new NurseryEntity(), nurseries, ({ uuid, name, projectId, status }) => ({
        fields: {
          uuid,
          name,
          projectUuid: projectUuids[projectId],
          status
        }
      }));
    });
  });

  describe("NurseryReportEntity", () => {
    let nurseryUuids: Record<number, string>;
    let reports: NurseryReport[];

    beforeAll(async () => {
      await NurseryReport.truncate();

      const nurseries = await NurseryFactory.createMany(2);
      nurseryUuids = nurseries.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      const nurseryIds = nurseries.reduce((ids, { id }) => [...ids, id], [] as number[]);
      const allReports = [];
      for (let ii = 0; ii < 15; ii++) {
        allReports.push(await NurseryReportFactory.create({ nurseryId: faker.helpers.arrayElement(nurseryIds) }));
      }
      allReports.push(await NurseryReportFactory.create({ nurseryId: null }));

      await allReports[6].destroy();
      reports = allReports.filter(report => !report.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new NurseryReportEntity(), reports, ({ uuid, nurseryId, status, dueAt }) => ({
        fields: {
          uuid,
          nurseryUuid: nurseryUuids[nurseryId],
          status,
          dueAt
        }
      }));
    });
  });

  describe("SiteEntity", () => {
    let projectUuids: Record<number, string>;
    let sites: Site[];

    beforeAll(async () => {
      await Site.truncate();

      const projects = await ProjectFactory.createMany(2);
      projectUuids = projects.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      const sites1 = await SiteFactory.createMany(7, { projectId: projects[0].id });
      await sites1[2].destroy();
      const sites2 = await SiteFactory.createMany(8, { projectId: projects[1].id });
      await sites2[1].destroy();
      const siteWithoutProject = await SiteFactory.create({ projectId: null });
      sites = [...sites1, ...sites2, siteWithoutProject].filter(site => !site.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new SiteEntity(), sites, ({ uuid, name, projectId, status }) => ({
        fields: {
          uuid,
          name,
          projectUuid: projectUuids[projectId],
          status
        }
      }));
    });
  });

  describe("SiteReportEntity", () => {
    let siteUuids: Record<number, string>;
    let reports: SiteReport[];

    beforeAll(async () => {
      await SiteReport.truncate();

      const sites = await SiteFactory.createMany(2);
      siteUuids = sites.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      const siteIds = sites.reduce((ids, { id }) => [...ids, id], [] as number[]);
      const allReports = [];
      for (let ii = 0; ii < 15; ii++) {
        allReports.push(await SiteReportFactory.create({ siteId: faker.helpers.arrayElement(siteIds) }));
      }
      allReports.push(await SiteReportFactory.create({ siteId: null }));

      await allReports[6].destroy();
      reports = allReports.filter(report => !report.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new SiteReportEntity(), reports, ({ uuid, siteId, status, dueAt }) => ({
        fields: {
          uuid,
          siteUuid: siteUuids[siteId],
          status,
          dueAt
        }
      }));
    });
  });
});
