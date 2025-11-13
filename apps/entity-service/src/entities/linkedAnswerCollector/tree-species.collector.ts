import { collectionCollector } from "./utils";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { EmbeddedTreeSpeciesDto } from "../dto/tree-species.dto";

export const treeSpeciesCollector = collectionCollector(
  "treeSpecies",
  TreeSpecies,
  "speciesableType",
  "speciesableId",
  { attributes: ["uuid", "name", "amount", "taxonId", "collection", "speciesableType"] },
  treeSpecies => new EmbeddedTreeSpeciesDto(treeSpecies)
);
