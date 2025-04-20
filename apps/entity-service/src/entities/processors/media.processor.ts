import {
  Media,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  Nursery,
  User,
  NurseryReport
} from "@terramatch-microservices/database/entities";
import { MediaDto } from "../dto/media.dto";
import { EntityModel, EntityType, EntityClass } from "@terramatch-microservices/database/constants/entities";
import { AssociationProcessor } from "./association-processor";
import { MediaQueryDto } from "../dto/media-query.dto";
import { EntitiesService } from "../entities.service";
import { DocumentBuilder, getDtoType, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { col, fn, Op, Sequelize } from "sequelize";
import { UserDto } from "@terramatch-microservices/common/dto/user.dto";
import { MediaAssociationDtoAdditionalProps } from "../dto/media-association.dto";

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

  private async getSiteModels(site: Site) {
    const models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [site.id] }];

    const siteReports = await SiteReport.findAll({ where: { siteId: site.id }, attributes: ["id"] });
    models.push({ modelType: SiteReport.LARAVEL_TYPE, ids: siteReports.map(report => report.id) });

    return models;
  }

  private async getNurseryModels(nursery: Nursery) {
    const models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [nursery.id] }];

    const nurseryReports = await NurseryReport.findAll({ where: { nurseryId: nursery.id }, attributes: ["id"] });
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, ids: nurseryReports.map(report => report.id) });

    return models;
  }

  private async getProjectModels(project: Project) {
    const models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [project.id] }];

    const projectReports = await ProjectReport.findAll({ where: { projectId: project.id }, attributes: ["id"] });
    models.push({ modelType: ProjectReport.LARAVEL_TYPE, ids: projectReports.map(report => report.id) });

    const sites = await Site.findAll({ where: { projectId: project.id }, attributes: ["id"] });
    models.push({ modelType: Site.LARAVEL_TYPE, ids: sites.map(site => site.id) });

    const siteReports = await SiteReport.findAll({
      where: { siteId: { [Op.in]: sites.map(site => site.id) } },
      attributes: ["id"]
    });
    models.push({ modelType: SiteReport.LARAVEL_TYPE, ids: siteReports.map(report => report.id) });

    const nurseries = await Nursery.findAll({ where: { projectId: project.id }, attributes: ["id"] });
    models.push({ modelType: Nursery.LARAVEL_TYPE, ids: nurseries.map(nursery => nursery.id) });

    const nurseryReports = await NurseryReport.findAll({
      where: { nurseryId: { [Op.in]: nurseries.map(nursery => nursery.id) } },
      attributes: ["id"]
    });
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, ids: nurseryReports.map(report => report.id) });

    return models;
  }

  private async getProjectReportModels(projectReport: ProjectReport) {
    const models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [projectReport.id] }];

    const fullProjectReport = await ProjectReport.findOne({ where: { id: projectReport.id } });

    const project = await Project.findOne({ where: { id: projectReport.projectId }, attributes: ["id"] });

    const sites = await Site.findAll({ where: { projectId: project.id }, attributes: ["id"] });
    const nurseries = await Nursery.findAll({ where: { projectId: project.id }, attributes: ["id"] });

    const siteReports = await SiteReport.findAll({
      where: {
        [Op.and]: [
          { siteId: { [Op.in]: sites.map(site => site.id) } },
          Sequelize.where(fn("MONTH", col("due_at")), fullProjectReport.dueAt.getMonth() + 1),
          Sequelize.where(fn("YEAR", col("due_at")), fullProjectReport.dueAt.getFullYear())
        ]
      },
      attributes: ["id"]
    });

    models.push({ modelType: SiteReport.LARAVEL_TYPE, ids: siteReports.map(report => report.id) });

    const nurseryReports = await NurseryReport.findAll({
      where: {
        [Op.and]: [
          { nurseryId: { [Op.in]: nurseries.map(nursery => nursery.id) } },
          Sequelize.where(fn("MONTH", col("due_at")), fullProjectReport.dueAt.getMonth() + 1),
          Sequelize.where(fn("YEAR", col("due_at")), fullProjectReport.dueAt.getFullYear())
        ]
      },
      attributes: ["id"]
    });
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, ids: nurseryReports.map(report => report.id) });

    return models;
  }

  private async getSiteReportModels(siteReport: SiteReport) {
    return [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [siteReport.id] }];
  }

  private async buildQuery(baseEntity: EntityModel, query: MediaQueryDto) {
    const builder = await this.entitiesService.buildQuery(Media, query);

    let models = [];
    if (baseEntity instanceof Project) {
      models = await this.getProjectModels(baseEntity);
    } else if (baseEntity instanceof Site) {
      models = await this.getSiteModels(baseEntity);
    } else if (baseEntity instanceof Nursery) {
      models = await this.getNurseryModels(baseEntity);
    } else if (baseEntity instanceof ProjectReport) {
      models = await this.getProjectReportModels(baseEntity);
    } else if (baseEntity instanceof SiteReport) {
      models = await this.getSiteReportModels(baseEntity);
    } else if (baseEntity instanceof NurseryReport) {
      models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, ids: [baseEntity.id] }];
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

    if (query.search != null) {
      builder.where({
        [Op.or]: [{ name: { [Op.like]: `%${query.search}%` } }, { fileName: { [Op.like]: `%${query.search}%` } }]
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
    const indexIds: string[] = [];
    for (const association of associations) {
      indexIds.push(association.uuid);
      const media = association as unknown as Media;

      const user = await User.findOne({ where: { id: media.createdBy } });

      const additionalProps: MediaAssociationDtoAdditionalProps = {
        entityType: this.entityType,
        entityUuid: this.entityUuid,
        url: this.entitiesService.fullUrl(media),
        thumbUrl: this.entitiesService.thumbnailUrl(media),
        createdBy: user != null ? new UserDto(user, []) : null
      };

      document.addData(association.uuid, new this.DTO(association, additionalProps));
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
