import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, WhereOptions } from "sequelize";
import { DocumentBuilder, getStableRequestQuery, IndexData } from "@terramatch-microservices/common/util";
import { EntitiesService, ProcessableEntity } from "../entities.service";
import { EntityQueryDto, SideloadType } from "../dto/entity-query.dto";
import { BadRequestException, Type } from "@nestjs/common";
import { EntityDto } from "../dto/entity.dto";
import { EntityModel, ReportModel } from "@terramatch-microservices/database/constants/entities";
import { Action } from "@terramatch-microservices/database/entities/action.entity";
import { EntityUpdateData, ReportUpdateAttributes } from "../dto/entity-update.dto";
import {
  APPROVED,
  NEEDS_MORE_INFORMATION,
  RESTORATION_IN_PROGRESS
} from "@terramatch-microservices/database/constants/status";
import { ProjectReport } from "@terramatch-microservices/database/entities";

export type Aggregate<M extends Model<M>> = {
  func: string;
  attr: keyof Attributes<M>;
};

export async function aggregateColumns<M extends Model<M>>(
  model: ModelCtor<M>,
  aggregates: Aggregate<M>[],
  where?: WhereOptions<M>
) {
  return (
    await model.findAll({
      where,
      raw: true,
      attributes: aggregates.map(({ func, attr }) => [fn(func, col(model.getAttributes()[attr].field)), attr as string])
    })
  )[0];
}

export type PaginatedResult<ModelType extends EntityModel> = {
  models: ModelType[];
  paginationTotal: number;
};

export type DtoResult<DtoType extends EntityDto> = {
  id: string;
  dto: DtoType;
};

const getIndexData = (
  resource: ProcessableEntity,
  query: EntityQueryDto,
  total: number,
  pageNumber: number
): Omit<IndexData, "ids"> => {
  const requestPath = `/entities/v3/${resource}${getStableRequestQuery(query)}`;
  return { resource, requestPath, total, pageNumber };
};

export abstract class EntityProcessor<
  ModelType extends EntityModel,
  LightDto extends EntityDto,
  FullDto extends EntityDto,
  UpdateDto extends EntityUpdateData
> {
  abstract readonly LIGHT_DTO: Type<LightDto>;
  abstract readonly FULL_DTO: Type<FullDto>;

  readonly APPROVAL_STATUSES = [APPROVED, NEEDS_MORE_INFORMATION, RESTORATION_IN_PROGRESS];

  constructor(protected readonly entitiesService: EntitiesService, protected readonly resource: ProcessableEntity) {}

  abstract findOne(uuid: string): Promise<ModelType | null>;
  abstract findMany(query: EntityQueryDto): Promise<PaginatedResult<ModelType>>;

  abstract getFullDto(model: ModelType): Promise<DtoResult<FullDto>>;
  abstract getLightDto(model: ModelType): Promise<DtoResult<LightDto>>;

  async getFullDtos(models: ModelType[]): Promise<DtoResult<FullDto>[]> {
    const results: DtoResult<FullDto>[] = [];
    for (const model of models) {
      results.push(await this.getFullDto(model));
    }
    return results;
  }

  async getLightDtos(models: ModelType[]): Promise<DtoResult<LightDto>[]> {
    const results: DtoResult<LightDto>[] = [];
    for (const model of models) {
      results.push(await this.getLightDto(model));
    }
    return results;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processSideload(
    document: DocumentBuilder,
    model: ModelType,
    entity: SideloadType,
    pageSize: number
  ): Promise<void> {
    throw new BadRequestException("This entity does not support sideloading");
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  async addIndex(document: DocumentBuilder, query: EntityQueryDto, sideloaded = false) {
    const { models, paginationTotal } = await this.findMany(query);
    const indexData = getIndexData(this.resource, query, paginationTotal, query.page?.number ?? 1);

    const indexIds: string[] = [];
    if (models.length !== 0) {
      await this.entitiesService.authorize("read", models);

      const dtoResults = await this.getLightDtos(models);

      for (const { id, dto } of dtoResults) {
        indexIds.push(id);
        if (sideloaded) document.addData(id, dto);
        else document.addData(id, dto);
      }
    }

    document.addIndexData({ ...indexData, ids: indexIds });

    if (models.length > 0 && !sideloaded && query.sideloads != null && query.sideloads.length > 0) {
      for (const model of models) {
        for (const { entity, pageSize } of query.sideloads) {
          await this.processSideload(document, model, entity, pageSize);
        }
      }
    }
  }

  async delete(model: ModelType) {
    await Action.for(model).destroy();
    await model.destroy();
  }

  /**
   * Performs the basic function of setting fields in EntityUpdateAttributes and saving the model.
   * If this concrete processor needs to support more fields on the update dto, override this method
   * and set the appropriate fields and then call super.update()
   */
  async update(model: ModelType, update: UpdateDto) {
    if (update.status != null) {
      if (this.APPROVAL_STATUSES.includes(update.status)) {
        await this.entitiesService.authorize("approve", model);

        // If an admin is doing an update, set the feedback / feedbackFields to whatever is in the
        // request, even if it's null. We ignore feedback / feedbackFields if the status is not
        // also being updated.
        model.feedback = update.feedback;
        model.feedbackFields = update.feedbackFields;
      }

      model.status = update.status as ModelType["status"];
    }

    await model.save();
  }
}

export abstract class ReportProcessor<
  ModelType extends ReportModel,
  LightDto extends EntityDto,
  FullDto extends EntityDto,
  UpdateDto extends ReportUpdateAttributes
> extends EntityProcessor<ModelType, LightDto, FullDto, UpdateDto> {
  async update(model: ModelType, update: UpdateDto) {
    if (update.nothingToReport != null) {
      if (model instanceof ProjectReport) {
        throw new BadRequestException("ProjectReport does not support nothingToReport");
      }

      if (update.nothingToReport !== model.nothingToReport) {
        model.nothingToReport = update.nothingToReport;

        if (model.nothingToReport) {
          const statusChanged = update.status != null && update.status !== model.status;
          if (statusChanged && update.status !== "awaiting-approval") {
            throw new BadRequestException(
              "Cannot set status to anything other than 'awaiting-approval' with nothingToReport: true"
            );
          }

          if (model.submittedAt == null) {
            model.completion = 100;
            model.submittedAt = new Date();
          }

          model.status = "awaiting-approval";
        }
      }
    }

    await super.update(model, update);
  }
}
