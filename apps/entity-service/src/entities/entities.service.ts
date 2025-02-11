import { BadRequestException, Injectable } from "@nestjs/common";
import { ProjectProcessor } from "./processors";

const ENTITY_PROCESSORS = {
  projects: ProjectProcessor
};

export type ProcessableEntity = keyof typeof ENTITY_PROCESSORS;
export const PROCESSABLE_ENTITIES = Object.keys(ENTITY_PROCESSORS) as ProcessableEntity[];

@Injectable()
export class EntitiesService {
  createProcessor(entity: ProcessableEntity) {
    const processorClass = ENTITY_PROCESSORS[entity];
    if (processorClass == null) {
      throw new BadRequestException(`Entity type invalid: ${entity}`);
    }

    return new processorClass();
  }
}
