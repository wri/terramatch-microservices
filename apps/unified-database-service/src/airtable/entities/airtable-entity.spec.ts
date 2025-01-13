import { AirtableEntity, ColumnMapping } from "./airtable-entity";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { ProjectFactory, SiteFactory } from "@terramatch-microservices/database/factories";
import Airtable from "airtable";
import { SiteEntity } from "./";
import { sortBy } from "lodash";

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

  describe("SiteEntity", () => {
    let projects: Project[];
    let projectUuids: Record<number, string>;
    let sites1: Site[];
    let sites2: Site[];

    beforeAll(async () => {
      await Site.truncate();
      await Project.truncate();

      projects = await ProjectFactory.createMany(2);
      projectUuids = projects.reduce((uuids, { id, uuid }) => ({ ...uuids, [id]: uuid }), {});
      sites1 = await SiteFactory.createMany(7, { projectId: projects[0].id });
      await sites1[2].destroy();
      await sites1[4].destroy();
      sites2 = await SiteFactory.createMany(8, { projectId: projects[1].id });
      await sites2[1].destroy();
    });

    it("sends all records to airtable", async () => {
      await new SiteEntity().updateBase(Base);
      expect(airtableUpdate).toHaveBeenCalledTimes(2);

      const sites = [...sites1, ...sites2].filter(site => !site.isSoftDeleted());
      const sitesCall1 = sortBy(sites.slice(0, 10), ["uuid"]);
      const sitesCall2 = sortBy(sites.slice(10), ["uuid"]);
      const updatesCall1 = sortBy(airtableUpdate.mock.calls[0][0], ["fields.uuid"]);
      const updatesCall2 = sortBy(airtableUpdate.mock.calls[1][0], ["fields.uuid"]);
      const spotCheckFields = ({ uuid, name, projectId, status }: Site) => ({
        fields: {
          uuid,
          name,
          projectUuid: projectUuids[projectId],
          status
        }
      });
      expect(updatesCall1).toMatchObject(sitesCall1.map(spotCheckFields));
      expect(updatesCall2).toMatchObject(sitesCall2.map(spotCheckFields));

      const columnsCall = Object.keys(updatesCall1[0].fields).sort();
      const columnsExpected = [
        "uuid",
        "createdAt",
        "updatedAt",
        "linkToTerramatch",
        "name",
        "projectUuid",
        "status",
        "updateRequestStatus",
        "sitingStrategy",
        "descriptionSitingStrategy"
      ].sort();
      expect(columnsCall).toMatchObject(columnsExpected);
    });
  });
});
