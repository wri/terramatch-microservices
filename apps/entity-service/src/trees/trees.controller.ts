import { BadRequestException, Controller, Get, Param, Query, UnauthorizedException } from "@nestjs/common";
import { TreeService } from "./tree.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ScientificNameDto } from "./dto/scientific-name.dto";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
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

@Controller("trees/v3")
@ApiExtraModels(PlantingCountDto, TreeEntityTypes)
export class TreesController {
  constructor(private readonly treeService: TreeService, private readonly policyService: PolicyService) {}

  @Get("scientific-names")
  @ApiOperation({
    operationId: "treeScientificNamesSearch",
    description: "Search scientific names of tree species. Returns up to 10 entries."
  })
  @JsonApiResponse({ data: ScientificNameDto, hasMany: true })
  async searchScientificNames(@Query("search") search: string) {
    if (isEmpty(search)) throw new BadRequestException("search query param is required");

    const document = buildJsonApi(ScientificNameDto, { forceDataArray: true });
    for (const treeSpecies of await this.treeService.searchScientificNames(search)) {
      document.addData(treeSpecies.taxonId, new ScientificNameDto(treeSpecies));
    }

    return document.serialize();
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
    return buildJsonApi(EstablishmentsTreesDto)
      .addData(`${entity}|${uuid}`, new EstablishmentsTreesDto({ establishmentTrees, previousPlantingCounts }))
      .document.serialize();
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

    const reportCounts = await this.treeService.getAssociatedReportCounts(entity, uuid);

    // The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
    // backed by a single DB table.
    return buildJsonApi(TreeReportCountsDto)
      .addData(`${entity}|${uuid}`, new TreeReportCountsDto({ reportCounts }))
      .document.serialize();
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
    // For this controller, the data about a given entity may be calculated and read if the base
    // entity may be read.
    await this.policyService.authorize("read", entityModel);
  }
}
