import { BadRequestException, Controller, Get, Param, Query, UnauthorizedException } from "@nestjs/common";
import { TreeService } from "./tree.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ScientificNameDto } from "./dto/scientific-name.dto";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { isEmpty } from "lodash";
import { EstablishmentsTreesParamsDto } from "./dto/establishments-trees-params.dto";
import { ApiException } from "@nanogiants/nestjs-swagger-api-exception-decorator";
import { EstablishmentsTreesDto, PreviousPlantingCountDto } from "./dto/establishment-trees.dto";

@Controller("trees/v3")
@ApiExtraModels(PreviousPlantingCountDto)
export class TreesController {
  constructor(private readonly treeService: TreeService) {}

  @Get("scientific-names")
  @ApiOperation({
    operationId: "treeScientificNamesSearch",
    description: "Search scientific names of tree species. Returns up to 10 entries."
  })
  @JsonApiResponse({ data: { type: ScientificNameDto }, hasMany: true })
  async searchScientificNames(@Query("search") search: string) {
    if (isEmpty(search)) throw new BadRequestException("search query param is required");

    const document = buildJsonApi({ forceDataArray: true });
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
  @JsonApiResponse({ data: { type: EstablishmentsTreesDto } })
  @ApiException(() => UnauthorizedException, { description: "Authentication failed." })
  @ApiException(() => BadRequestException, { description: "One or more path param values is invalid." })
  async getEstablishmentData(@Param() { entity, uuid }: EstablishmentsTreesParamsDto) {
    const establishmentTrees = await this.treeService.getEstablishmentTrees(entity, uuid);
    const previousPlantingCounts = await this.treeService.getPreviousPlanting(entity, uuid);

    // The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
    // backed by a single DB table.
    return buildJsonApi()
      .addData(`${entity}|${uuid}`, new EstablishmentsTreesDto({ establishmentTrees, previousPlantingCounts }))
      .document.serialize();
  }
}
