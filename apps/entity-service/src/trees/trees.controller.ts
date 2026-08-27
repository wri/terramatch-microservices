import { Response } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { isEstablishmentEntity, isReportCountEntity, TreeService } from "./tree.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ScientificNameDto } from "./dto/scientific-name.dto";
import { ApiExtraModels, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { intersection, isEmpty } from "lodash";
import { EstablishmentsTreesParamsDto } from "./dto/establishments-trees-params.dto";
import { EstablishmentsTreesDto } from "./dto/establishment-trees.dto";
import { TreeReportCountsParamsDto } from "./dto/tree-report-counts-params.dto";
import { TreeReportCountsDto } from "./dto/tree-report-counts.dto";
import { TreeEntityTypes } from "./dto/tree-entity-types.dto";
import { PlantingCountDto } from "./dto/planting-count.dto";
import { ENTITY_MODELS, EntityType } from "@terramatch-microservices/database/constants/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { SpeciesDto } from "./dto/species.dto";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { Task } from "@terramatch-microservices/database/entities";
import { BulkCsvDownloadQueryDto, TreeBulkUploadBody, TreeBulkUploadDto } from "./dto/tree-bulk-upload.dto";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("trees/v3")
@ApiExtraModels(PlantingCountDto, SpeciesDto, TreeEntityTypes)
export class TreesController {
  constructor(
    private readonly treeService: TreeService,
    private readonly policyService: PolicyService
  ) {}

  @Get("scientificNames")
  @ApiOperation({
    operationId: "treeScientificNamesSearch",
    description: "Search scientific names of tree species. Returns up to 10 entries."
  })
  @JsonApiResponse({ data: ScientificNameDto, hasMany: true })
  async searchScientificNames(@Query("search") search: string) {
    if (isEmpty(search)) throw new BadRequestException("search query param is required");

    const document = buildJsonApi(ScientificNameDto, { forceDataArray: true });
    for (const treeSpecies of await this.treeService.searchScientificNames(search)) {
      document.addData(treeSpecies.taxonId, populateDto(new ScientificNameDto(), treeSpecies));
    }

    return document.addIndex({ requestPath: `/trees/v3/scientificNames${getStableRequestQuery({ search })}` });
  }

  @Get("establishments/:entity/:uuid")
  @ApiOperation({
    operationId: "establishmentTreesFind",
    summary: "Get tree data related to the establishment of an entity"
  })
  @JsonApiResponse(EstablishmentsTreesDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more path param values is invalid." })
  async getEstablishmentData(@Param() { entity, uuid }: EstablishmentsTreesParamsDto) {
    await this.authorizeRead(entity, uuid);

    const establishmentTrees = await this.treeService.getEstablishmentTrees(entity, uuid);
    const previousPlantingCounts = await this.treeService.getPreviousPlanting(entity, uuid);

    // The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
    // backed by a single DB table.
    return buildJsonApi(EstablishmentsTreesDto).addData(
      `${entity}|${uuid}`,
      populateDto(new EstablishmentsTreesDto(), { establishmentTrees, previousPlantingCounts })
    );
  }

  @Get("reportCounts/:entity/:uuid")
  @ApiOperation({
    operationId: "treeReportCountsFind",
    summary: "Get tree species counts from reports related to the entity"
  })
  @JsonApiResponse(TreeReportCountsDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more path param values is invalid." })
  async getReportCounts(@Param() { entity, uuid }: TreeReportCountsParamsDto) {
    await this.authorizeRead(entity, uuid);

    const establishmentTrees = !isEstablishmentEntity(entity)
      ? undefined
      : await this.treeService.getEstablishmentTrees(entity, uuid);
    const reportCounts = !isReportCountEntity(entity)
      ? undefined
      : await this.treeService.getAssociatedReportCounts(entity, uuid);

    // The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
    // backed by a single DB table.
    return buildJsonApi(TreeReportCountsDto).addData(
      `${entity}|${uuid}`,
      populateDto(new TreeReportCountsDto(), { establishmentTrees, reportCounts })
    );
  }

  @Get("bulkImportCsv/:uuid")
  @ApiOperation({
    operationId: "treeBulkImportCsvGet",
    summary: "Get a CSV for bulk importing tree data for a given task"
  })
  @ApiResponse({
    status: 200,
    description: "CSV file",
    content: { "text/csv": { schema: { type: "string" } } }
  })
  @ExceptionResponse(NotFoundException, { description: "Task not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this task" })
  async getBulkImportCsv(
    @Param() { uuid }: SingleResourceDto,
    @Query() { collection }: BulkCsvDownloadQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // If there is no query at all, the DTO validation doesn't process
    if (collection == null) throw new BadRequestException("Collection is required");

    const task = await Task.findOne({ where: { uuid } });
    if (task == null) throw new NotFoundException();

    await this.policyService.authorize("read", task);
    await this.treeService.getBulkImportCsv(task, collection, response);
  }

  @Post("bulkImportCsv/:uuid")
  @ApiOperation({
    operationId: "treeBulkImportCsvUpload",
    summary: "Upload a CSV for bulk importing tree data for a given task"
  })
  @JsonApiResponse(TreeBulkUploadDto)
  @ExceptionResponse(NotFoundException, { description: "Task not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this task" })
  @UseInterceptors(FileInterceptor("uploadFile"), FormDtoInterceptor)
  async uploadBulkImportCsv(
    @Param() { uuid }: SingleResourceDto,
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: TreeBulkUploadBody
  ) {
    const task = await Task.findOne({ where: { uuid } });
    if (task == null) throw new NotFoundException();

    if (payload.data.type !== "treeBulkUploads") {
      throw new BadRequestException("Bad data type for tree bulk upload data");
    }

    await this.policyService.authorize("update", task);
    return buildJsonApi<TreeBulkUploadDto>(TreeBulkUploadDto).addData(
      uuid,
      new TreeBulkUploadDto(await this.treeService.bulkImportTreeCsv(task, file))
    );
  }

  private async authorizeRead(entity: EntityType, uuid: string) {
    const modelClass = ENTITY_MODELS[entity];
    const attributes = intersection(
      // The list of attributes that might be needed by a given entity policy to determine if
      // this user has access
      ["id", "frameworkKey", "projectId", "siteId", "nurseryId"],
      Object.keys(modelClass.getAttributes())
    );
    const entityModel = await modelClass.findOne({ where: { uuid }, attributes });
    if (entityModel == null) throw new NotFoundException("Entity not found");
    // For this controller, the data about a given entity may be calculated and read if the base
    // entity may be read.
    await this.policyService.authorize("read", entityModel);
  }
}
