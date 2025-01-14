import { airtableColumnName, AirtableEntity, ColumnMapping } from "./airtable-entity";
import { faker } from "@faker-js/faker";
import {
  Application,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import {
  ApplicationFactory,
  DemographicFactory,
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
  WorkdayFactory
} from "@terramatch-microservices/database/factories";
import Airtable from "airtable";
import {
  ApplicationEntity,
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
import { FRAMEWORK_NAMES, FrameworkKey } from "@terramatch-microservices/database/constants/framework";

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

describe("AirtableEntity", () => {
  afterEach(async () => {
    airtableUpdate.mockClear();
  });

  // This spec only tests the error cases. The individual entity tests cover everything else.
  describe("BaseClass", () => {
    beforeAll(async () => {
      // Ensure there's at least one site so the mapping happens
      await SiteFactory.create();
    });

    it("re-raises mapping errors", async () => {
      mapEntityColumns.mockRejectedValue(new Error("mapping error"));
      await expect(new StubEntity().updateBase(null, 0)).rejects.toThrow("mapping error");
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

    beforeAll(async () => {
      await Project.truncate();

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

      projects = allProjects.filter(project => !project.isSoftDeleted());
      applicationUuids = (
        await Application.findAll({
          where: { id: projects.map(({ applicationId }) => applicationId) },
          attributes: ["id", "uuid"]
        })
      ).reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});

      // Add some additional records to test calculations
      const { id: projectReport1 } = await ProjectReportFactory.create({
        projectId: projects[0].id,
        status: "started", // Not an approved status, so this one should not be included in calculations
        ftTotal: 1,
        ptTotal: 1
      });
      const { id: projectReport2 } = await ProjectReportFactory.create({
        projectId: projects[0].id,
        status: "approved",
        ftTotal: 2
      });
      await ProjectReportFactory.create({
        projectId: projects[0].id,
        status: "approved",
        ptTotal: 6
      });

      await NurseryFactory.create({ projectId: projects[0].id, status: "approved" });

      const { uuid: startedSiteUuid } = await SiteFactory.create({ projectId: projects[0].id, status: "started" });
      const { id: site1, uuid: site1Uuid } = await SiteFactory.create({
        projectId: projects[0].id,
        status: "approved"
      });
      const { id: site2, uuid: site2Uuid } = await SiteFactory.create({
        projectId: projects[0].id,
        status: "approved"
      });
      await SiteFactory.create({ projectId: projects[0].id, status: "approved" });

      const { id: siteReport1 } = await SiteReportFactory.create({
        siteId: site1,
        status: "due"
      });
      const { id: siteReport2 } = await SiteReportFactory.create({
        siteId: site1,
        status: "approved"
      });
      const { id: siteReport3 } = await SiteReportFactory.create({
        siteId: site2,
        status: "approved"
      });
      const { id: siteReport4 } = await SiteReportFactory.create({
        siteId: site2,
        status: "approved"
      });

      // won't count because siteReport1 is not an approved report
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport1 });
      let treesPlantedToDate = (
        await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport2 })
      ).amount;
      // won't count because it's hidden
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport3, hidden: true });
      // won't count because it's the wrong collection
      await TreeSpeciesFactory.forSiteReportNonTree.create({ speciesableId: siteReport4 });
      treesPlantedToDate += (await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport4 }))
        .amount;
      treesPlantedToDate += (await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport4 }))
        .amount;
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReport4, amount: null });

      await SeedingFactory.forSiteReport.create({ seedableId: siteReport1 });
      let seedsPlantedToDate = (await SeedingFactory.forSiteReport.create({ seedableId: siteReport2 })).amount;
      await SeedingFactory.forSiteReport.create({ seedableId: siteReport4, amount: null });
      seedsPlantedToDate += (await SeedingFactory.forSiteReport.create({ seedableId: siteReport4 })).amount;

      // won't count because siteReport1 is not approved
      await SitePolygonFactory.create({ siteUuid: startedSiteUuid });
      let hectaresRestoredToDate = (await SitePolygonFactory.create({ siteUuid: site1Uuid })).calcArea;
      // won't count because it's not active
      await SitePolygonFactory.create({ siteUuid: site2Uuid, isActive: false });
      hectaresRestoredToDate += (await SitePolygonFactory.create({ siteUuid: site2Uuid })).calcArea;

      // won't count because project report 1 isn't approved
      const { id: workday1 } = await WorkdayFactory.forProjectReport.create({ workdayableId: projectReport1 });
      await DemographicFactory.forWorkday.create({ demographicalId: workday1, type: "gender" });
      const { id: workday2 } = await WorkdayFactory.forProjectReport.create({ workdayableId: projectReport2 });
      let workdaysCount = (await DemographicFactory.forWorkday.create({ demographicalId: workday2, type: "gender" }))
        .amount;
      // ignored because only gender is used
      await DemographicFactory.forWorkday.create({ demographicalId: workday2, type: "age" });
      const { id: workday3 } = await WorkdayFactory.forSiteReport.create({ workdayableId: siteReport3 });
      workdaysCount += (await DemographicFactory.forWorkday.create({ demographicalId: workday3, type: "gender" }))
        .amount;

      calculatedValues = {
        [projects[0].uuid]: {
          jobsCreatedToDate: 8,
          numberOfSites: 3,
          numberOfNurseries: 1,
          treesPlantedToDate,
          seedsPlantedToDate,
          hectaresRestoredToDate: Math.round(hectaresRestoredToDate),
          workdaysCount
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
            cohort: FRAMEWORK_NAMES[frameworkKey] ?? frameworkKey,
            organisationUuid: organisationUuids[organisationId],
            applicationUuid: applicationUuids[applicationId],
            jobsCreatedToDate: calculatedValues[uuid]?.jobsCreatedToDate ?? 0,
            numberOfSites: calculatedValues[uuid]?.numberOfSites ?? 0,
            numberOfNurseries: calculatedValues[uuid]?.numberOfNurseries ?? 0,
            treesPlantedToDate: calculatedValues[uuid]?.treesPlantedToDate ?? 0,
            seedsPlantedToDate: calculatedValues[uuid]?.seedsPlantedToDate ?? 0,
            hectaresRestoredToDate: calculatedValues[uuid]?.hectaresRestoredToDate ?? 0,
            workdaysCount: calculatedValues[uuid]?.workdaysCount ?? 0
          }
        })
      );
    });
  });

  describe("ProjectReportEntity", () => {
    let projectUuids: Record<number, string>;
    let reports: ProjectReport[];

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

      await allReports[6].destroy();
      reports = allReports.filter(report => !report.isSoftDeleted());
    });

    it("sends all records to airtable", async () => {
      await testAirtableUpdates(new ProjectReportEntity(), reports, ({ uuid, projectId, status, dueAt }) => ({
        fields: {
          uuid,
          projectUuid: projectUuids[projectId],
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

  describe("TreeSpeciesEntity", () => {
    let associationUuids: Record<string, { airtableField: string; uuid: string }>;
    let trees: TreeSpecies[];

    beforeAll(async () => {
      await TreeSpecies.truncate();

      associationUuids = {};
      const nursery = await NurseryFactory.create();
      associationUuids[Nursery.LARAVEL_TYPE] = { airtableField: "nurseryUuid", uuid: nursery.uuid };
      const nurseryReport = await NurseryReportFactory.create();
      associationUuids[NurseryReport.LARAVEL_TYPE] = { airtableField: "nurseryReportUuid", uuid: nurseryReport.uuid };
      const organisation = await OrganisationFactory.create();
      associationUuids[Organisation.LARAVEL_TYPE] = { airtableField: "organisationUuid", uuid: organisation.uuid };
      const project = await ProjectFactory.create();
      associationUuids[Project.LARAVEL_TYPE] = { airtableField: "projectUuid", uuid: project.uuid };
      const projectReport = await ProjectReportFactory.create();
      associationUuids[ProjectReport.LARAVEL_TYPE] = { airtableField: "projectReportUuid", uuid: projectReport.uuid };
      const site = await SiteFactory.create();
      associationUuids[Site.LARAVEL_TYPE] = { airtableField: "siteUuid", uuid: site.uuid };
      const siteReport = await SiteReportFactory.create();
      associationUuids[SiteReport.LARAVEL_TYPE] = { airtableField: "siteReportUuid", uuid: siteReport.uuid };

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
            nurseryUuid: speciesableType === Nursery.LARAVEL_TYPE ? associationUuids[speciesableType].uuid : undefined,
            nurseryReportUuid:
              speciesableType === NurseryReport.LARAVEL_TYPE && speciesableId > 0
                ? associationUuids[speciesableType].uuid
                : undefined,
            projectUuid: speciesableType === Project.LARAVEL_TYPE ? associationUuids[speciesableType].uuid : undefined,
            projectReportUuid:
              speciesableType === ProjectReport.LARAVEL_TYPE ? associationUuids[speciesableType].uuid : undefined,
            siteUuid: speciesableType === Site.LARAVEL_TYPE ? associationUuids[speciesableType].uuid : undefined,
            siteReportUuid:
              speciesableType === SiteReport.LARAVEL_TYPE ? associationUuids[speciesableType].uuid : undefined
          }
        })
      );
    });
  });
});
