import { Media, Nursery, NurseryReport, Seeding } from "@terramatch-microservices/database/entities";
import { NurseryLightDto, NurseryFullDto, AdditionalNurseryFullProps, NurseryMedia } from "../dto/nursery.dto";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Includeable, Op } from "sequelize";

export class NurseryProcessor extends EntityProcessor<Nursery, NurseryLightDto, NurseryFullDto> {
  readonly LIGHT_DTO = NurseryLightDto;
  readonly FULL_DTO = NurseryFullDto;

  async findOne(uuid: string): Promise<Nursery> {
    return await Nursery.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["uuid", "name"],
          include: [{ association: "organisation", attributes: ["name"] }]
        }
      ]
    });
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
    const nuseryId = nursery.id;

    const nurseriesReports = await NurseryReport.nurseries([nuseryId]).findAll({
      attributes: ["id", "seedlingsYoungTrees"]
    });

    const seedlingsGrownCount = nurseriesReports.reduce((sum, { seedlingsYoungTrees }) => {
      return sum + (seedlingsYoungTrees ?? 0);
    }, 0);

    const nuseryReportsTotal = nurseriesReports.length;
    const overdueNurseryReportsTotal = await this.getTotalOverdueReports(nuseryId);
    const props: AdditionalNurseryFullProps = {
      seedlingsGrownCount,
      nuseryReportsTotal,
      overdueNurseryReportsTotal,

      ...(this.entitiesService.mapMediaCollection(
        await Media.nursery(nuseryId).findAll(),
        Nursery.MEDIA
      ) as NurseryMedia)
    };

    document.addData(nursery.uuid, new NurseryFullDto(nursery, props));
  }

  async addLightDto(document: DocumentBuilder, nursery: Nursery): Promise<void> {
    document.addData(nursery.uuid, new NurseryLightDto(nursery));
  }

  protected async getTotalOverdueReports(nuseryId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    return await NurseryReport.incomplete().nurseries([nuseryId]).count(countOpts);
  }
}
