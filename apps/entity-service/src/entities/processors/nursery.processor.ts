import { Nursery } from "@terramatch-microservices/database/entities";
import { NurseryLightDto, NurseryFullDto, AdditionalNurseryFullProps } from "../dto/nursery.dto";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Includeable } from "sequelize";

export class NurseryProcessor extends EntityProcessor<Nursery, NurseryLightDto, NurseryFullDto> {
  readonly LIGHT_DTO = NurseryLightDto;
  readonly FULL_DTO = NurseryFullDto;

  async findOne(uuid: string): Promise<Nursery> {
    return await Nursery.findOne({ where: { uuid } });
  }

  async findMany(query: EntityQueryDto): Promise<PaginatedResult<Nursery>> {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["name"] }]
    };

    const associations = [projectAssociation];
    const builder = await this.entitiesService.buildQuery(Nursery, query, associations);
    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addFullDto(document: DocumentBuilder, nursery: Nursery): Promise<void> {
    const props: AdditionalNurseryFullProps = {};
    document.addData(nursery.uuid, new NurseryFullDto(nursery, props));
  }

  async addLightDto(document: DocumentBuilder, nursery: Nursery): Promise<void> {
    document.addData(nursery.uuid, new NurseryLightDto(nursery));
  }
}
