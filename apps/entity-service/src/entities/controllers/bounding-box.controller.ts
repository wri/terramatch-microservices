import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { BoundingBoxService } from "../services/bounding-box.service";
import { BoundingBoxQueryDto } from "../dto/bounding-box-query.dto";
import { BoundingBoxDto } from "../dto/bounding-box.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";

@Controller("v3/boundingBoxes")
@ApiTags("Bounding Boxes")
export class BoundingBoxController {
  constructor(private readonly boundingBoxService: BoundingBoxService) {}

  @Get()
  @ApiOkResponse({ description: "Bounding box retrieved successfully" })
  @JsonApiResponse({ data: BoundingBoxDto })
  async getBoundingBox(@Query() query: BoundingBoxQueryDto): Promise<BoundingBoxDto> {
    if (query.polygonUuid) {
      return this.boundingBoxService.getPolygonBoundingBox(query.polygonUuid);
    }

    if (query.siteUuid) {
      return this.boundingBoxService.getSiteBoundingBox(query.siteUuid);
    }

    if (query.projectUuid) {
      return this.boundingBoxService.getProjectBoundingBox(query.projectUuid);
    }

    if (query.projectUuids && query.projectUuids.length) {
      return this.boundingBoxService.getProjectsCentroidBoundingBox(query.projectUuids);
    }

    if (query.country || (query.landscapes && query.landscapes.length)) {
      return this.boundingBoxService.getCountryLandscapeBoundingBox(query.country, query.landscapes || []);
    }

    throw new Error(
      "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, projectUuids, landscape, country, or country with landscapes."
    );
  }
}
