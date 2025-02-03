import { airtableColumnName, AirtableEntity, ColumnMapping } from "./airtable-entity";
import { faker } from "@faker-js/faker";
import {
  Application,
  DemographicEntry,
  Framework,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  TreeSpecies,
  Demographic
} from "@terramatch-microservices/database/entities";
import {
  ApplicationFactory,
  DemographicEntryFactory,
  FormSubmissionFactory,
  FundingProgrammeFactory,
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  SeedingFactory,
  SiteFactory,
  SitePolygonFactory,
  SiteReportFactory,
  TreeSpeciesFactory,
  DemographicFactory
} from "@terramatch-microservices/database/factories";
import Airtable from "airtable";
import {
  ApplicationEntity,
  DemographicEntity,
  DemographicEntryEntity,
  NurseryEntity,
  NurseryReportEntity,
  OrganisationEntity,
  ProjectEntity,
  ProjectReportEntity,
  SiteEntity,
  SiteReportEntity,
  TreeSpeciesEntity
} from "./";
import { orderBy, sortBy } from "lodash";
import { Model } from "sequelize-typescript";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { FindOptions, Op } from "sequelize";
import { DateTime } from "luxon";

const airtableUpdate = jest.fn<Promise<unknown>, [{ fields: object }[], object]>(() => Promise.resolve());
const airtableSelectFirstPage = jest.fn<Promise<unknown>, never>(() => Promise.resolve([]));
const airtableSelect = jest.fn(() => ({ firstPage: airtableSelectFirstPage }));
const airtableDestroy = jest.fn(() => Promise.resolve());
const Base = jest.fn(() => ({
  update: airtableUpdate,
  select: airtableSelect,
  destroy: airtableDestroy
})) as unknown as Airtable.Base;

const mapEntityColumns = jest.fn(() => Promise.resolve({}));
export class StubEntity extends AirtableEntity<Site> {
  readonly TABLE_NAME = "stubs";
  readonly COLUMNS = ["id"] as ColumnMapping<Site>[];
  readonly MODEL = Site;

  protected getUpdatePageFindOptions = (page: number, updatedSince?: Date) => ({
    ...super.getUpdatePageFindOptions(page, updatedSince),
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

describe("AirtableEntity", () => {
  afterEach(async () => {
    airtableUpdate.mockClear();
    airtableSelect.mockClear();
    airtableSelectFirstPage.mockClear();
    airtableDestroy.mockClear();
  });

  describe("BaseClass", () => {
    describe("updateBase", () => {
      beforeAll(async () => {
        // Ensure there's at least one site so the mapping happens
        await SiteFactory.create();
      });

      it("re-raises mapping errors", async () => {
        mapEntityColumns.mockRejectedValue(new Error("mapping error"));
        await expect(new StubEntity().updateBase(null, { startPage: 0 })).rejects.toThrow("mapping error");
        mapEntityColumns.mockReset();
      });

      it("re-raises airtable errors", async () => {
        airtableUpdate.mockRejectedValue(new Error("airtable error"));
        await expect(new StubEntity().updateBase(Base)).rejects.toThrow("airtable error");
        airtableUpdate.mockReset();
      });

      it("includes the updatedSince timestamp in the query", async () => {
        const entity = new StubEntity();
        const spy = jest.spyOn(entity as never, "getUpdatePageFindOptions") as jest.SpyInstance<FindOptions<Site>>;
        const updatedSince = new Date();
        await entity.updateBase(Base, { updatedSince });
        expect(spy.mock.results[0].value.where).toMatchObject({
          updatedAt: { [Op.gte]: updatedSince }
        });
        spy.mockReset();
      });

      it("skips the updatedSince timestamp if the model doesn't support it", async () => {
        const entity = new StubEntity();
        // @ts-expect-error overriding readonly property for test.
        (entity as never).SUPPORTS_UPDATED_SINCE = false;
        const spy = jest.spyOn(entity as never, "getUpdatePageFindOptions") as jest.SpyInstance<FindOptions<Site>>;
        const updatedSince = new Date();
        await entity.updateBase(Base, { updatedSince });
        expect(spy.mock.results[0].value.where).not.toMatchObject({
          updatedAt: expect.anything()
        });
      });
    });

    describe("deleteStaleRecords", () => {
      let deletedSites: Site[];
      const deletedSince = DateTime.fromJSDate(new Date()).minus({ days: 2 }).toJSDate();

      beforeAll(async () => {
        // Truncate on a paranoid model soft deletes instead of removing the row. There is a force: true
        // option, but it doesn't work on tables that have foreign key constraints from other tables
        // so we're working around it here by making sure all rows in the table were "deleted" before
        // our deletedSince timestamp before creating new rows
        await Site.truncate();
        await Site.update(
          { deletedAt: DateTime.fromJSDate(deletedSince).minus({ days: 1 }).toJSDate() },
          { where: {}, paranoid: false }
        );

        const sites = await SiteFactory.createMany(25);
        for (const site of faker.helpers.uniqueArray(sites, 9)) {
          await site.destroy();
        }

        deletedSites = sites.filter(site => site.isSoftDeleted());
      });

      it("re-raises search errors", async () => {
        airtableSelectFirstPage.mockRejectedValue(new Error("select error"));
        await expect(new SiteEntity().deleteStaleRecords(Base, deletedSince)).rejects.toThrow("select error");
      });

      it("re-raises delete errors", async () => {
        airtableSelectFirstPage.mockResolvedValue([{ id: "fakeid", fields: { uuid: "fakeuuid" } }]);
        airtableDestroy.mockRejectedValue(new Error("delete error"));
        await expect(new SiteEntity().deleteStaleRecords(Base, deletedSince)).rejects.toThrow("delete error");
        airtableDestroy.mockReset();
      });

      it("calls delete with all records found", async () => {
        const searchResult = deletedSites.map(({ uuid }) => ({
          id: String(faker.number.int({ min: 1000, max: 9999 })),
          fields: { uuid }
        }));
        airtableSelectFirstPage.mockResolvedValue(searchResult);
        await new SiteEntity().deleteStaleRecords(Base, deletedSince);
        expect(airtableSelect).toHaveBeenCalledTimes(1);
        expect(airtableSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            fields: ["uuid"],
            filterByFormula: expect.stringMatching(
              `(${deletedSites.map(({ uuid }) => `{uuid}='${uuid}'`).join("|")}{${deletedSites.length + 1})`
            )
          })
        );
        expect(airtableDestroy).toHaveBeenCalledTimes(1);
        expect(airtableDestroy).toHaveBeenCalledWith(expect.arrayContaining(searchResult.map(({ id }) => id)));
      });
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

  describe("DemographicEntity", () => {
    let associationUuids: Record<string, string>;
    let demographics: Demographic[];

    beforeAll(async () => {
      await Demographic.truncate();

      associationUuids = {};
      const projectReport = await ProjectReportFactory.create();
      associationUuids[ProjectReport.LARAVEL_TYPE] = projectReport.uuid;
      const siteReport = await SiteReportFactory.create();
      associationUuids[SiteReport.LARAVEL_TYPE] = siteReport.uuid;

      const factories = [
        () => DemographicFactory.forProjectReportWorkday.create({ demographicalId: projectReport.id }),
        () => DemographicFactory.forSiteReportWorkday.create({ demographicalId: siteReport.id }),
        () => DemographicFactory.forProjectReportRestorationPartner.create({ demographicalId: projectReport.id })
      ];

      const allDemographics: Demographic[] = [];
      for (const factory of factories) {
        // make sure we have at least one of each type
        allDemographics.push(await factory());
      }
      for (let ii = 0; ii < 35; ii++) {
        // create a whole bunch mor at random
        allDemographics.push(await faker.helpers.arrayElement(factories)());
      }
      const toDeleteOrHide = faker.helpers.uniqueArray(() => faker.number.int(allDemographics.length - 1), 10);
      let hide = true;
      for (const ii of toDeleteOrHide) {
        if (hide) {
          await allDemographics[ii].update({ hidden: true });
        } else {
          await allDemographics[ii].destroy();
        }
        hide = !hide;
      }

      // create one with a bogus association type for testing
      allDemographics.push(
        await DemographicFactory.forProjectReportWorkday.create({ demographicalType: "foo", demographicalId: 1 })
      );
      allDemographics.push(await DemographicFactory.forSiteReportWorkday.create({ demographicalId: 0 }));

      demographics = allDemographics.filter(workday => !workday.isSoftDeleted() && workday.hidden === false);
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(
        new DemographicEntity(),
        demographics,
        ({ uuid, collection, demographicalType, demographicalId }) => ({
          fields: {
            uuid,
            collection,
            projectReportUuid:
              demographicalType === ProjectReport.LARAVEL_TYPE ? associationUuids[demographicalType] : undefined,
            siteReportUuid:
              demographicalType === SiteReport.LARAVEL_TYPE && demographicalId > 0
                ? associationUuids[demographicalType]
                : undefined
          }
        })
      );
    });
  });

  describe("DemographicEntryEntity", () => {
    let demographicUuids: Record<number, string>;
    let entries: DemographicEntry[];

    beforeAll(async () => {
      await DemographicEntry.truncate();

      const projectWorkday = await DemographicFactory.forProjectReportWorkday.create();
      const siteWorkday = await DemographicFactory.forSiteReportWorkday.create();
      const projectPartner = await DemographicFactory.forProjectReportRestorationPartner.create();
      demographicUuids = {
        [projectWorkday.id]: projectWorkday.uuid,
        [siteWorkday.id]: siteWorkday.uuid,
        [projectPartner.id]: projectPartner.uuid
      };

      const factories = [
        () => DemographicEntryFactory.create({ demographicId: projectWorkday.id }),
        () => DemographicEntryFactory.create({ demographicId: siteWorkday.id }),
        () => DemographicEntryFactory.create({ demographicId: projectPartner.id })
      ];

      const allDemographics = [];
      for (const factory of factories) {
        allDemographics.push(await factory());
      }
      for (let ii = 0; ii < 35; ii++) {
        allDemographics.push(await faker.helpers.arrayElement(factories)());
      }

      const toDelete = faker.helpers.uniqueArray(() => faker.number.int(allDemographics.length - 1), 10);
      for (const ii of toDelete) {
        await allDemographics[ii].destroy();
      }

      entries = allDemographics.filter(demographic => !demographic.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(
        new DemographicEntryEntity(),
        entries,
        ({ id, type, subtype, name, amount, demographicId }) => ({
          fields: {
            id,
            type,
            subtype,
            name,
            amount,
            demographicUuid: demographicUuids[demographicId]
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
      const projectIds = projects.map(({ id }) => id);
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

  describe("OrganisationEntity", () => {
    let organisations: Organisation[];

    beforeAll(async () => {
      await Organisation.truncate();

      const allOrgs = await OrganisationFactory.createMany(16);
      await allOrgs[5].destroy();
      await allOrgs[12].destroy();

      organisations = allOrgs.filter(org => !org.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new OrganisationEntity(), organisations, ({ uuid, name, status }) => ({
        fields: {
          uuid,
          name,
          status
        }
      }));
    });
  });

  describe("ProjectEntity", () => {
    let organisationUuids: Record<number, string>;
    let applicationUuids: Record<number, string>;
    let projects: Project[];
    let calculatedValues: Record<string, Record<string, string | number>>;

    const FRAMEWORK_NAMES = {
      ppc: "PPC",
      terrafund: "TerraFund Top 100"
    };

    beforeAll(async () => {
      await Project.truncate();

      for (const framework of await Framework.findAll()) {
        await framework.destroy();
      }
      for (const [slug, name] of Object.entries(FRAMEWORK_NAMES)) {
        await Framework.create({ uuid: faker.string.uuid(), slug, name });
      }

      const orgs = await OrganisationFactory.createMany(3);
      organisationUuids = orgs.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      const orgIds = orgs.reduce((ids, { id }) => [...ids, id], [] as number[]);
      const orgId = () => faker.helpers.arrayElement(orgIds);

      const allProjects = [] as Project[];
      for (let ii = 0; ii < 15; ii++) {
        allProjects.push(await ProjectFactory.create({ organisationId: orgId() }));
      }

      for (const ii of faker.helpers.uniqueArray(() => allProjects.length - 1, 2)) {
        await allProjects[ii].destroy();
      }

      // include some slightly broken fields for testing.
      allProjects.push(
        await ProjectFactory.create({
          organisationId: null,
          continent: null,
          applicationId: null,
          frameworkKey: "foo" as FrameworkKey
        })
      );

      // make sure test projects are not included
      await ProjectFactory.create({ organisationId: orgId(), isTest: true });

      projects = allProjects.filter(project => !project.isSoftDeleted());
      applicationUuids = (
        await Application.findAll({
          where: { id: projects.map(({ applicationId }) => applicationId) },
          attributes: ["id", "uuid"]
        })
      ).reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});

      await NurseryFactory.create({ projectId: projects[0].id, status: "approved" });

      const { uuid: startedSiteUuid } = await SiteFactory.create({ projectId: projects[0].id, status: "started" });
      const { uuid: site1Uuid } = await SiteFactory.create({
        projectId: projects[0].id,
        status: "approved"
      });
      const { uuid: site2Uuid } = await SiteFactory.create({
        projectId: projects[0].id,
        status: "approved"
      });
      await SiteFactory.create({ projectId: projects[0].id, status: "approved" });

      // won't count because siteReport1 is not approved
      await SitePolygonFactory.create({ siteUuid: startedSiteUuid });
      let hectaresRestoredToDate = (await SitePolygonFactory.create({ siteUuid: site1Uuid })).calcArea;
      // won't count because it's not active
      await SitePolygonFactory.create({ siteUuid: site2Uuid, isActive: false });
      hectaresRestoredToDate += (await SitePolygonFactory.create({ siteUuid: site2Uuid })).calcArea;

      calculatedValues = {
        [projects[0].uuid]: {
          hectaresRestoredToDate: Math.round(hectaresRestoredToDate)
        }
      };
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(
        new ProjectEntity(),
        projects,
        ({ uuid, name, frameworkKey, organisationId, applicationId }) => ({
          fields: {
            uuid,
            name,
            framework: FRAMEWORK_NAMES[frameworkKey] ?? frameworkKey,
            organisationUuid: organisationUuids[organisationId],
            applicationUuid: applicationUuids[applicationId],
            hectaresRestoredToDate: calculatedValues[uuid]?.hectaresRestoredToDate ?? 0
          }
        })
      );
    });
  });

  describe("ProjectReportEntity", () => {
    let projectUuids: Record<number, string>;
    let reports: ProjectReport[];
    let calculatedValues: Record<string, Record<string, string | number>>;

    beforeAll(async () => {
      await ProjectReport.truncate();

      const projects = await ProjectFactory.createMany(2);
      projectUuids = projects.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      const projectIds = projects.reduce((ids, { id }) => [...ids, id], [] as number[]);
      const allReports = [];
      for (let ii = 0; ii < 15; ii++) {
        allReports.push(await ProjectReportFactory.create({ projectId: faker.helpers.arrayElement(projectIds) }));
      }
      allReports.push(await ProjectReportFactory.create({ projectId: null }));

      const ppcReport = await ProjectReportFactory.create({
        projectId: faker.helpers.arrayElement(projectIds),
        frameworkKey: "ppc"
      });
      allReports.push(ppcReport);
      const ppcSeedlings = (
        await TreeSpeciesFactory.forProjectReportTreePlanted.createMany(3, { speciesableId: ppcReport.id })
      ).reduce((total, { amount }) => total + amount, 0);
      // make sure hidden is ignored
      await TreeSpeciesFactory.forProjectReportTreePlanted.create({ speciesableId: ppcReport.id, hidden: true });

      // TODO this might start causing problems when Task is implemented in this codebase and we have a factory
      // that's generating real records
      const terrafundReport = await ProjectReportFactory.create({
        projectId: faker.helpers.arrayElement(projectIds),
        frameworkKey: "terrafund",
        taskId: 123
      });
      allReports.push(terrafundReport);
      const terrafundSeedlings = (
        await NurseryReportFactory.createMany(2, {
          taskId: terrafundReport.taskId,
          seedlingsYoungTrees: faker.number.int({ min: 10, max: 100 }),
          status: "approved"
        })
      ).reduce((total, { seedlingsYoungTrees }) => total + seedlingsYoungTrees, 0);
      // make sure non-approved reports are ignored
      await NurseryReportFactory.create({
        taskId: terrafundReport.taskId,
        seedlingsYoungTrees: faker.number.int({ min: 10, max: 100 }),
        status: "due"
      });

      await allReports[6].destroy();
      reports = allReports.filter(report => !report.isSoftDeleted());

      calculatedValues = {
        [ppcReport.uuid]: {
          totalSeedlingsGrown: ppcSeedlings
        },
        [terrafundReport.uuid]: {
          totalSeedlingsGrown: terrafundSeedlings
        }
      };
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new ProjectReportEntity(), reports, ({ uuid, projectId, status, dueAt }) => ({
        fields: {
          uuid,
          projectUuid: projectUuids[projectId],
          status,
          dueAt,
          totalSeedlingsGrown: calculatedValues[uuid]?.totalSeedlingsGrown ?? 0
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
    let totalSeedsPlanted: Record<number, number>;
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

      const seedings = await SeedingFactory.forSiteReport.createMany(3, { seedableId: allReports[0].id });
      totalSeedsPlanted = { [allReports[0].id]: seedings.reduce((total, { amount }) => total + amount, 0) };

      await allReports[6].destroy();
      reports = allReports.filter(report => !report.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new SiteReportEntity(), reports, ({ id, uuid, siteId, status, dueAt }) => ({
        fields: {
          uuid,
          siteUuid: siteUuids[siteId],
          status,
          dueAt,
          totalSeedsPlanted: totalSeedsPlanted[id] ?? 0
        }
      }));
    });
  });

  describe("TreeSpeciesEntity", () => {
    let associationUuids: Record<string, string>;
    let trees: TreeSpecies[];

    beforeAll(async () => {
      await TreeSpecies.truncate();

      associationUuids = {};
      const nursery = await NurseryFactory.create();
      associationUuids[Nursery.LARAVEL_TYPE] = nursery.uuid;
      const nurseryReport = await NurseryReportFactory.create();
      associationUuids[NurseryReport.LARAVEL_TYPE] = nurseryReport.uuid;
      const organisation = await OrganisationFactory.create();
      associationUuids[Organisation.LARAVEL_TYPE] = organisation.uuid;
      const project = await ProjectFactory.create();
      associationUuids[Project.LARAVEL_TYPE] = project.uuid;
      const projectReport = await ProjectReportFactory.create();
      associationUuids[ProjectReport.LARAVEL_TYPE] = projectReport.uuid;
      const site = await SiteFactory.create();
      associationUuids[Site.LARAVEL_TYPE] = site.uuid;
      const siteReport = await SiteReportFactory.create();
      associationUuids[SiteReport.LARAVEL_TYPE] = siteReport.uuid;

      const factories = [
        () => TreeSpeciesFactory.forNurserySeedling.create({ speciesableId: nursery.id }),
        () => TreeSpeciesFactory.forNurseryReportSeedling.create({ speciesableId: nurseryReport.id }),
        () => TreeSpeciesFactory.forProjectTreePlanted.create({ speciesableId: project.id }),
        () => TreeSpeciesFactory.forProjectReportTreePlanted.create({ speciesableId: projectReport.id }),
        () => TreeSpeciesFactory.forSiteTreePlanted.create({ speciesableId: site.id }),
        () => TreeSpeciesFactory.forSiteNonTree.create({ speciesableId: site.id }),
        () => TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport.id }),
        () => TreeSpeciesFactory.forSiteReportNonTree.create({ speciesableId: siteReport.id })
      ];

      const allTrees: TreeSpecies[] = [];
      for (const factory of factories) {
        // make sure we have at least one of each type
        allTrees.push(await factory());
      }
      for (let ii = 0; ii < 35; ii++) {
        // create a whole bunch more at random
        allTrees.push(await faker.helpers.arrayElement(factories)());
      }
      const toDeleteOrHide = faker.helpers.uniqueArray(() => faker.number.int(allTrees.length - 1), 10);
      let hide = true;
      for (const ii of toDeleteOrHide) {
        if (hide) {
          await allTrees[ii].update({ hidden: true });
        } else {
          await allTrees[ii].destroy();
        }
        hide = !hide;
      }

      // create one with a bogus association type for testing
      allTrees.push(await TreeSpeciesFactory.forNurserySeedling.create({ speciesableType: "foo", speciesableId: 3 }));
      // create one with a bad association id for testing
      allTrees.push(await TreeSpeciesFactory.forNurseryReportSeedling.create({ speciesableId: 0 }));

      trees = allTrees.filter(tree => !tree.isSoftDeleted() && tree.hidden === false);
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(
        new TreeSpeciesEntity(),
        trees,
        ({ uuid, name, amount, collection, speciesableType, speciesableId }) => ({
          fields: {
            uuid,
            name,
            amount,
            collection,
            nurseryUuid: speciesableType === Nursery.LARAVEL_TYPE ? associationUuids[speciesableType] : undefined,
            nurseryReportUuid:
              speciesableType === NurseryReport.LARAVEL_TYPE && speciesableId > 0
                ? associationUuids[speciesableType]
                : undefined,
            projectUuid: speciesableType === Project.LARAVEL_TYPE ? associationUuids[speciesableType] : undefined,
            projectReportUuid:
              speciesableType === ProjectReport.LARAVEL_TYPE ? associationUuids[speciesableType] : undefined,
            siteUuid: speciesableType === Site.LARAVEL_TYPE ? associationUuids[speciesableType] : undefined,
            siteReportUuid: speciesableType === SiteReport.LARAVEL_TYPE ? associationUuids[speciesableType] : undefined
          }
        })
      );
    });

    it("customizes the where clause for deleting records", async () => {
      class Test extends TreeSpeciesEntity {
        // make method accessible
        public getDeletePageFindOptions = (deletedSince: Date, page: number) =>
          super.getDeletePageFindOptions(deletedSince, page);
      }
      const deletedSince = new Date();
      const result = new Test().getDeletePageFindOptions(deletedSince, 0);
      expect(result.where[Op.or]).not.toBeNull();
      expect(result.where[Op.or]?.[Op.and]?.updatedAt?.[Op.gte]).toBe(deletedSince);
    });
  });
});
