import { Invasive } from "@terramatch-microservices/database/entities";
import { polymorphicCollector } from "./utils";
import { EmbeddedInvasiveDto } from "../dto/invasive.dto";

export const invasivesCollector = polymorphicCollector(Invasive, EmbeddedInvasiveDto, { usesCollection: false });
