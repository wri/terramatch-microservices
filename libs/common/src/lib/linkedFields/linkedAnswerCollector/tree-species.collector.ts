import { polymorphicCollector } from "./utils";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { EmbeddedTreeSpeciesDto } from "../../dto/tree-species.dto";

export const treeSpeciesCollector = polymorphicCollector(TreeSpecies, EmbeddedTreeSpeciesDto);
