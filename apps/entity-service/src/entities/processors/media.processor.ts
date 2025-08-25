import {
  Media,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  Nursery,
  NurseryReport,
  FinancialReport
} from "@terramatch-microservices/database/entities";
import { MediaDto } from "../dto/media.dto";
import { EntityModel, EntityType, EntityClass } from "@terramatch-microservices/database/constants/entities";
import { AssociationProcessor } from "./association-processor";
import { MediaQueryDto } from "../dto/media-query.dto";
import { EntitiesService } from "../entities.service";
import { DocumentBuilder, getDtoType, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { col, fn, Includeable, Op, Sequelize } from "sequelize";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Literal } from "sequelize/types/utils";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

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
    protected readonly entitiesService: EntitiesService,
    protected readonly query: MediaQueryDto = {}
  ) {
    super(entityType, entityUuid, entityModelClass, entitiesService, query);
  }

  get baseModelAttributes() {
    return [...super.baseModelAttributes, "dueAt"];
  }

  private getBaseEntityModels(baseEntity: EntityModel): QueryModelType[] {
    return [{ modelType: this.entityModelClass.LARAVEL_TYPE, subquery: [baseEntity.id] }];
  }

  private async getProjectModels(project: Project) {
    const models: QueryModelType[] = this.getBaseEntityModels(project);

    const projectReportSubquery = Subquery.select(ProjectReport, "id").eq("projectId", project.id);
    models.push({ modelType: ProjectReport.LARAVEL_TYPE, subquery: projectReportSubquery.literal });

    const siteSubquery = Subquery.select(Site, "id").eq("projectId", project.id);
    models.push({ modelType: Site.LARAVEL_TYPE, subquery: siteSubquery.literal });

    const siteReportSubquery = Subquery.select(SiteReport, "id").in("siteId", siteSubquery.literal);
    models.push({ modelType: SiteReport.LARAVEL_TYPE, subquery: siteReportSubquery.literal });

    const nurserySubquery = Subquery.select(Nursery, "id").eq("projectId", project.id);
    models.push({ modelType: Nursery.LARAVEL_TYPE, subquery: nurserySubquery.literal });

    const nurseryReportSubquery = Subquery.select(NurseryReport, "id").in("nurseryId", nurserySubquery.literal);
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, subquery: nurseryReportSubquery.literal });

    return models;
  }

  private async getSiteModels(site: Site) {
    const models: QueryModelType[] = this.getBaseEntityModels(site);
    const subquery = Subquery.select(SiteReport, "id").eq("siteId", site.id);
    models.push({ modelType: SiteReport.LARAVEL_TYPE, subquery: subquery.literal });
    return models;
  }

  private async getNurseryModels(nursery: Nursery) {
    const models: QueryModelType[] = this.getBaseEntityModels(nursery);
    const subquery = Subquery.select(NurseryReport, "id").eq("nurseryId", nursery.id);
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, subquery: subquery.literal });
    return models;
  }

  private async getProjectReportModels(projectReport: ProjectReport) {
    const models: QueryModelType[] = this.getBaseEntityModels(projectReport);

    const siteSubquery = Subquery.select(Site, "id").eq("projectId", projectReport.projectId);
    const nurserySubquery = Subquery.select(Nursery, "id").eq("projectId", projectReport.projectId);

    let siteReports: SiteReport[] = [];
    if (projectReport.dueAt != null) {
      siteReports = await SiteReport.findAll({
        where: {
          [Op.and]: [
            { siteId: { [Op.in]: siteSubquery.literal } },
            Sequelize.where(fn("MONTH", col("due_at")), projectReport.dueAt.getMonth() + 1),
            Sequelize.where(fn("YEAR", col("due_at")), projectReport.dueAt.getFullYear())
          ]
        },
        attributes: ["id"]
      });
    }

    models.push({ modelType: SiteReport.LARAVEL_TYPE, subquery: siteReports.map(report => report.id) });

    let nurseryReports: NurseryReport[] = [];
    if (projectReport.dueAt != null) {
      nurseryReports = await NurseryReport.findAll({
        where: {
          [Op.and]: [
            { nurseryId: { [Op.in]: nurserySubquery.literal } },
            Sequelize.where(fn("MONTH", col("due_at")), projectReport.dueAt.getMonth() + 1),
            Sequelize.where(fn("YEAR", col("due_at")), projectReport.dueAt.getFullYear())
          ]
        },
        attributes: ["id"]
      });
    }
    models.push({ modelType: NurseryReport.LARAVEL_TYPE, subquery: nurseryReports.map(report => report.id) });

    return models;
  }

  private async getFinancialReportModels(financialReport: FinancialReport) {
    const models: QueryModelType[] = this.getBaseEntityModels(financialReport);
    return models;
  }

  _queryBuilder: PaginatedQueryBuilder<Media> | null = null;
  private async getQueryBuilder() {
    if (this._queryBuilder != null) return this._queryBuilder;
    const baseEntity: EntityModel = await this.getBaseEntity();

    const userAssociations: Includeable = {
      association: "createdByUser",
      attributes: ["firstName", "lastName"]
    };

    this._queryBuilder = await this.entitiesService.buildQuery(Media, this.query, [userAssociations]);

    let models: QueryModelType[];
    if (baseEntity instanceof Project) {
      models = await this.getProjectModels(baseEntity);
    } else if (baseEntity instanceof Site) {
      models = await this.getSiteModels(baseEntity);
    } else if (baseEntity instanceof Nursery) {
      models = await this.getNurseryModels(baseEntity);
    } else if (baseEntity instanceof ProjectReport) {
      models = await this.getProjectReportModels(baseEntity);
    } else if (baseEntity instanceof FinancialReport) {
      models = await this.getFinancialReportModels(baseEntity);
    } else {
      models = this.getBaseEntityModels(baseEntity);
    }

    this._queryBuilder.where({
      [Op.or]: models.map(model => {
        return {
          modelType: model.modelType,
          modelId: {
            [Op.in]: model.subquery
          }
        };
      })
    });

    if (this.query.isGeotagged != null) {
      this._queryBuilder.where({
        [Op.and]: [
          {
            lat: {
              [this.query.isGeotagged ? Op.ne : Op.eq]: null
            },
            lng: {
              [this.query.isGeotagged ? Op.ne : Op.eq]: null
            }
          }
        ]
      });
    }

    if (this.query.isPublic != null) {
      this._queryBuilder.where({
        isPublic: this.query.isPublic
      });
    }

    if (this.query.isCover != null) {
      this._queryBuilder.where({
        isCover: this.query.isCover
      });
    }

    if (this.query.search != null) {
      this._queryBuilder.where({
        [Op.or]: [
          { name: { [Op.like]: `%${this.query.search}%` } },
          { fileName: { [Op.like]: `%${this.query.search}%` } }
        ]
      });
    }

    if (this.query.fileType != null) {
      this._queryBuilder.where({
        fileType: this.query.fileType
      });
    }

    if (this.query.direction != null) {
      this._queryBuilder.order(["createdAt", this.query.direction]);
    }
    return this._queryBuilder;
  }

  public async getAssociations() {
    const builder = await this.getQueryBuilder();
    return builder.execute();
  }

  public async getTotal() {
    const builder = await this.getQueryBuilder();
    return builder.paginationTotal();
  }

  public async addDtos(document: DocumentBuilder): Promise<void> {
    const associations = await this.getAssociations();
    const indexIds: string[] = [];
    for (const association of associations) {
      indexIds.push(association.uuid);
      const media = association as unknown as Media;

      document.addData(
        association.uuid,
        this.entitiesService.mediaDto(media, { entityType: this.entityType, entityUuid: this.entityUuid })
      );
    }

    const total = await this.getTotal();

    const resource = getDtoType(this.DTO);
    document.addIndexData({
      resource,
      requestPath: `/entities/v3/${this.entityType}/${this.entityUuid}/${resource}${getStableRequestQuery(this.query)}`,
      total,
      pageNumber: this.query?.page?.number,
      ids: indexIds
    });
  }
}
