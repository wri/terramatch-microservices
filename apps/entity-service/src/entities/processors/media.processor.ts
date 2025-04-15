import { Media, Site, SiteReport, User } from "@terramatch-microservices/database/entities";
import { MediaDto } from "../dto/media.dto";
import { EntityModel, EntityType, EntityClass } from "@terramatch-microservices/database/constants/entities";
import { AssociationProcessor } from "./association-processor";
import { MediaQueryDto } from "../dto/media-query.dto";
import { EntitiesService } from "../entities.service";
import { DocumentBuilder, getDtoType, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { Op } from "sequelize";
import { UserDto } from "@terramatch-microservices/common/dto/user.dto";

export class MediaProcessor extends AssociationProcessor<Media, MediaDto> {
  readonly DTO = MediaDto;

  constructor(
    protected readonly entityType: EntityType,
    protected readonly entityUuid: string,
    protected readonly entityModelClass: EntityClass<EntityModel>,
    protected readonly entitiesService: EntitiesService
  ) {
    super(entityType, entityUuid, entityModelClass, entitiesService);
  }

  private async buildQuery(baseEntity: EntityModel, query: MediaQueryDto) {
    const builder = await this.entitiesService.buildQuery(Media, query);
    const models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [baseEntity.id] }];
    if (this.entityModelClass.LARAVEL_TYPE === Site.LARAVEL_TYPE) {
      const siteReports = await SiteReport.findAll({ where: { siteId: baseEntity.id }, attributes: ["id"] });
      models.push({ modelType: SiteReport.LARAVEL_TYPE, ids: siteReports.map(report => report.id) });
    }

    builder.where({
      [Op.or]: models.map(model => {
        return {
          modelType: model.modelType,
          modelId: {
            [Op.in]: model.ids
          }
        };
      })
    });

    if (query.isGeotagged != null) {
      builder.where({
        [Op.and]: [
          {
            lat: {
              [query.isGeotagged ? Op.ne : Op.eq]: null
            },
            lng: {
              [query.isGeotagged ? Op.ne : Op.eq]: null
            }
          }
        ]
      });
    }

    if (query.isPublic != null) {
      builder.where({
        isPublic: query.isPublic ? "1" : "0"
      });
    }

    if (query.fileType != null) {
      builder.where({
        fileType: query.fileType
      });
    }

    if (query.direction) {
      builder.order(["createdAt", query.direction]);
    }
    return builder;
  }

  public async getAssociations(baseEntity: EntityModel, query: MediaQueryDto) {
    const builder = await this.buildQuery(baseEntity, query);

    return builder.execute();
  }

  protected async getTotal(baseEntity: EntityModel, query: MediaQueryDto) {
    const builder = await this.buildQuery(baseEntity, query);
    return builder.paginationTotal();
  }

  public async addDtos(document: DocumentBuilder, query: MediaQueryDto): Promise<void> {
    const associations = await this.getAssociations(await this.getBaseEntity(), query);

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    const indexIds: string[] = [];
    for (const association of associations) {
      indexIds.push(association.uuid);
      const media = association as unknown as Media;
      const user = media.createdBy ? await User.findOne({ where: { id: media.createdBy } }) : null;
      document.addData(
        association.uuid,
        new this.DTO(
          association,
          this.entitiesService.fullUrl(media),
          this.entitiesService.thumbnailUrl(media),
          user ? new UserDto(user, []) : null,
          additionalProps
        )
      );
    }

    const total = await this.getTotal(await this.getBaseEntity(), query);

    const resource = getDtoType(this.DTO);
    document.addIndexData({
      resource,
      requestPath: `/entities/v3/${this.entityType}/${this.entityUuid}/${resource}${getStableRequestQuery(query)}`,
      total,
      pageNumber: query.page?.number,
      ids: indexIds
    });
  }
}
