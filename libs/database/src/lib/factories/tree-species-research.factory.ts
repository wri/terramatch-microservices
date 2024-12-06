import { FactoryGirl } from "factory-girl-ts";
import { TreeSpeciesResearch } from "../entities";
import { faker } from "@faker-js/faker";

export const TreeSpeciesResearchFactory = FactoryGirl.define(TreeSpeciesResearch, async () => ({
  taxonId: await generateUniqueTaxonId(),
  scientificName: faker.word.words(2),
  family: faker.word.words(1),
  genus: faker.word.words(1),
  specificEpithet: faker.word.words()
}));

async function generateUniqueTaxonId() {
  let taxonId = generateTaxonId();
  while ((await TreeSpeciesResearch.findByPk(taxonId)) != null) taxonId = generateTaxonId();
  return taxonId;
}

const generateTaxonId = () => {
  const taxonId = `000000000${faker.number.int(9999999999)}`;
  return `wfo-${taxonId.substring(taxonId.length - 10)}`;
};
