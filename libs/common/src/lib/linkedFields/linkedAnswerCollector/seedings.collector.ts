import { Seeding } from "@terramatch-microservices/database/entities";
import { polymorphicCollector } from "./utils";
import { EmbeddedSeedingDto } from "../../dto/seeding.dto";

export const seedingsCollector = polymorphicCollector(Seeding, EmbeddedSeedingDto);
