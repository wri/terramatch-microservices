import { AirtableEntity, ColumnMapping } from "./airtable-entity";
import { Site } from "@terramatch-microservices/database/entities";
import { SiteFactory } from "@terramatch-microservices/database/factories";
import Airtable from "airtable";

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
  beforeAll(async () => {
    // Ensure there's at least one site so the mapping happens
    await SiteFactory.create();
  });

  it("re-raises mapping errors", async () => {
    mapEntityColumns.mockRejectedValue(new Error("mapping error"));
    const entity = new StubEntity();
    await expect(entity.updateBase(null)).rejects.toThrow("mapping error");
    mapEntityColumns.mockReset();
  });

  it("re-raises airtable errors", async () => {
    const entity = new StubEntity();
    const base = jest.fn(() => ({
      update: () => Promise.reject(new Error("airtable error"))
    })) as unknown as Airtable.Base;
    await expect(entity.updateBase(base)).rejects.toThrow("airtable error");
  });
});
