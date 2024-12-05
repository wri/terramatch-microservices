import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ResearchService } from "./research.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ScientificNameDto } from "./dto/scientific-name.dto";
import { ApiOperation } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { isEmpty } from "lodash";

@Controller("trees/v3")
export class TreesController {
  constructor(private readonly researchService: ResearchService) {}

  @Get("scientific-names")
  @ApiOperation({
    operationId: "treeScientificNames",
    description: "Search scientific names of tree species. Returns up to 10 entries."
  })
  @JsonApiResponse({ data: { type: ScientificNameDto } })
  async searchScientificNames(@Query("search") search: string) {
    if (isEmpty(search)) throw new BadRequestException("search query param is required");

    const document = buildJsonApi();
    for (const treeSpecies of await this.researchService.searchScientificNames(search)) {
      document.addData(treeSpecies.taxonId, new ScientificNameDto(treeSpecies));
    }

    return document.serialize();
  }
}
