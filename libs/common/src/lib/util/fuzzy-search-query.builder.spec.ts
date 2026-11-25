import { TreeSpeciesResearch } from "@terramatch-microservices/database/entities";
import { TreeSpeciesResearchFactory } from "@terramatch-microservices/database/factories";
import { FUZZY_SEARCH_LIMIT, FuzzySearchQueryBuilder } from "./fuzzy-search-query.builder";

describe("FuzzySearchQueryBuilder", () => {
  beforeEach(async () => {
    await TreeSpeciesResearch.truncate({ force: true });
  });

  it("matches only at the beginning of a word, shortest first", async () => {
    await TreeSpeciesResearchFactory.create({ scientificName: "Ipsum loremium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Lorem asdfium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Lorem as" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Alorem ipsium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Fakem ipslorem" });

    const result = await new FuzzySearchQueryBuilder(TreeSpeciesResearch, "scientificName").execute("lore");
    expect(result.map(({ scientificName }) => scientificName)).toEqual(["Lorem as", "Lorem asdfium", "Ipsum loremium"]);
  });

  it("limits the attributes fetched", async () => {
    await TreeSpeciesResearchFactory.create({ scientificName: "Lorem asdfium" });

    const [result] = await new FuzzySearchQueryBuilder(TreeSpeciesResearch, "scientificName")
      .attributes(["taxonId"])
      .execute("lore");
    expect(result.taxonId).toBeDefined();
    expect(result.scientificName).toBeUndefined();
  });

  it("applies additional where conditions", async () => {
    await TreeSpeciesResearchFactory.create({ scientificName: "Lorem asdfium", family: "Fabaceae" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Lorem qasdium", family: "Myrtaceae" });

    const result = await new FuzzySearchQueryBuilder(TreeSpeciesResearch, "scientificName")
      .where({ family: "Fabaceae" })
      .execute("lore");
    expect(result.map(({ scientificName }) => scientificName)).toEqual(["Lorem asdfium"]);
  });

  it("limits the number of results", async () => {
    for (let ii = 0; ii < FUZZY_SEARCH_LIMIT + 2; ii++) {
      await TreeSpeciesResearchFactory.create({ scientificName: `Tree species ${ii}` });
    }

    const result = await new FuzzySearchQueryBuilder(TreeSpeciesResearch, "scientificName").execute("tree");
    expect(result.length).toBe(FUZZY_SEARCH_LIMIT);
  });
});
