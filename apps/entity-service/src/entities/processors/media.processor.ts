import {
  Media,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  Nursery,
  NurseryReport
} from "@terramatch-microservices/database/entities";
import { MediaDto } from "../dto/media.dto";
import { EntityModel, EntityType, EntityClass } from "@terramatch-microservices/database/constants/entities";
import { AssociationProcessor } from "./association-processor";
import { MediaQueryDto } from "../dto/media-query.dto";
import { EntitiesService } from "../entities.service";
import { DocumentBuilder, getDtoType, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { col, fn, Includeable, Op, Sequelize } from "sequelize";
import { MediaAssociationDtoAdditionalProps } from "../dto/media-association.dto";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Literal } from "sequelize/types/utils";

type QueryModelType = {
  modelType: string;
  subquery: number[] | Literal;
};

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

  private async getSiteModels(site: Site): Promise<QueryModelType[]> {
    const models: QueryModelType[] = [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [site.id] }];
    const subquery = Subquery.select(SiteReport, "id").eq("siteId", site.id);
    models.push({ modelType: SiteReport.LARAVEL_TYPE, subquery: subquery.literal });
    return models;
  }

  private async getNurseryModels(nursery: Nursery) {
    const models: QueryModelType[] = [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [nursery.id] }];
    const subquery = Subquery.select(NurseryReport, "id").eq("nurseryId", nursery.id);
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, subquery: subquery.literal });
    return models;
  }

  private async getProjectModels(project: Project) {
    const models: QueryModelType[] = [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [project.id] }];

    const projectReportSubquery = Subquery.select(ProjectReport, "id").eq("projectId", project.id);
    models.push({ modelType: ProjectReport.LARAVEL_TYPE, subquery: projectReportSubquery.literal });

    const siteSubquery = Subquery.select(Site, "id").eq("projectId", project.id);
    models.push({ modelType: Site.LARAVEL_TYPE, subquery: siteSubquery.literal });

    const sites = await Site.findAll({ where: { projectId: project.id }, attributes: ["id"] });

    const siteReportSubquery = Subquery.select(SiteReport, "id").in(
      "siteId",
      sites.map(site => site.id)
    );
    models.push({ modelType: SiteReport.LARAVEL_TYPE, subquery: siteReportSubquery.literal });

    const nurseries = await Nursery.findAll({ where: { projectId: project.id }, attributes: ["id"] });
    const nurserySubquery = Subquery.select(Nursery, "id").eq("projectId", project.id);
    models.push({ modelType: Nursery.LARAVEL_TYPE, subquery: nurserySubquery.literal });

    const nurseryReportSubquery = Subquery.select(NurseryReport, "id").in(
      "nurseryId",
      nurseries.map(nursery => nursery.id)
    );
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, subquery: nurseryReportSubquery.literal });

    return models;
  }

  private async getProjectReportModels(projectReport: ProjectReport) {
    const models: QueryModelType[] = [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [projectReport.id] }];

    const projectReportWithDue = await ProjectReport.findOne({
      where: { id: projectReport.id },
      attributes: ["dueAt"]
    });

    const project = await Project.findOne({ where: { id: projectReport.projectId }, attributes: ["id"] });

    const siteSubquery = Subquery.select(Site, "id").eq("projectId", project.id);
    const nurserySubquery = Subquery.select(Nursery, "id").eq("projectId", project.id);

    let siteReports = [];
    if (projectReportWithDue.dueAt != null) {
      siteReports = await SiteReport.findAll({
        where: {
          [Op.and]: [
            { siteId: { [Op.in]: siteSubquery.literal } },
            Sequelize.where(fn("MONTH", col("due_at")), projectReportWithDue.dueAt.getMonth() + 1),
            Sequelize.where(fn("YEAR", col("due_at")), projectReportWithDue.dueAt.getFullYear())
          ]
        },
        attributes: ["id"]
      });
    }

    models.push({ modelType: SiteReport.LARAVEL_TYPE, subquery: siteReports.map(report => report.id) });

    let nurseryReports = [];
    if (projectReportWithDue.dueAt != null) {
      nurseryReports = await NurseryReport.findAll({
        where: {
          [Op.and]: [
            { nurseryId: { [Op.in]: nurserySubquery.literal } },
            Sequelize.where(fn("MONTH", col("due_at")), projectReportWithDue.dueAt.getMonth() + 1),
            Sequelize.where(fn("YEAR", col("due_at")), projectReportWithDue.dueAt.getFullYear())
          ]
        },
        attributes: ["id"]
      });
    }
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, subquery: nurseryReports.map(report => report.id) });

    return models;
  }

  private async getSiteReportModels(siteReport: SiteReport) {
    return [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [siteReport.id] }];
  }

  private async buildQuery(baseEntity: EntityModel, query: MediaQueryDto) {
    const userAssociations: Includeable = {
      association: "createdByUser",
      attributes: ["firstName", "lastName"]
    };

    const builder = await this.entitiesService.buildQuery(Media, query, [userAssociations]);

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
      models = [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [baseEntity.id] }];
    }

    builder.where({
      [Op.or]: models.map(model => {
        return {
          modelType: model.modelType,
          modelId: {
            [Op.in]: model.subquery
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
        isPublic: query.isPublic
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

  public async getTotal(baseEntity: EntityModel, query: MediaQueryDto) {
    const builder = await this.buildQuery(baseEntity, query);
    return builder.paginationTotal();
  }

  public async addDtos(document: DocumentBuilder, query: MediaQueryDto): Promise<void> {
    const associations = await this.getAssociations(await this.getBaseEntity(), query);
    const indexIds: string[] = [];
    for (const association of associations) {
      indexIds.push(association.uuid);
      const media = association as unknown as Media;

      const additionalProps: MediaAssociationDtoAdditionalProps = {
        entityType: this.entityType,
        entityUuid: this.entityUuid,
        url: this.entitiesService.fullUrl(media),
        thumbUrl: this.entitiesService.thumbnailUrl(media),
        modelType: this.entityType
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
