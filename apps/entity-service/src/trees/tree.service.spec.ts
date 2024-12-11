import { TreeService } from "./tree.service";
import { Test } from "@nestjs/testing";
import { TreeSpeciesResearch } from "@terramatch-microservices/database/entities";
import { pick } from "lodash";
import { faker } from "@faker-js/faker";
import { TreeSpeciesResearchFactory } from "@terramatch-microservices/database/factories";

describe("ResearchService", () => {
  let service: TreeService;

  beforeAll(async () => {
    await TreeSpeciesResearch.truncate();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TreeService]
    }).compile();

    service = module.get(TreeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an empty array with no matches", async () => {
    const result = await service.searchScientificNames("test");
    expect(result.length).toBe(0);
  });

  it("should return the matching entries", async () => {
    const tree1 = await TreeSpeciesResearchFactory.create({ scientificName: "Lorem asdfium" });
    const tree2 = await TreeSpeciesResearchFactory.create({ scientificName: "Lorem qasdium" });
    const tree3 = await TreeSpeciesResearchFactory.create({ scientificName: "Ipsum loremium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Alorem ipsium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Fakem ipslorem" });
    const result = await service.searchScientificNames("lore");
    expect(result.length).toBe(3);
    expect(result).toContainEqual(pick(tree1, ["taxonId", "scientificName"]));
    expect(result).toContainEqual(pick(tree2, ["taxonId", "scientificName"]));
    expect(result).toContainEqual(pick(tree3, ["taxonId", "scientificName"]));
  });

  it("should return 10 entries maximum", async () => {
    for (let ii = 0; ii < 12; ii++) {
      await TreeSpeciesResearchFactory.create({ scientificName: `Tree${faker.word.words()}` });
    }

    const result = await service.searchScientificNames("tree");
    expect(result.length).toBe(10);
  });
});
