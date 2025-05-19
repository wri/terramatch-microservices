import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BoundingBoxService } from "../services/bounding-box.service";
import { BoundingBoxQueryDto } from "../dto/bounding-box-query.dto";
import { BoundingBoxDto } from "../dto/bounding-box.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";

@Controller("v3/boundingBoxes")
@ApiTags("Bounding Boxes")
export class BoundingBoxController {
  constructor(private readonly boundingBoxService: BoundingBoxService) {}

  @Get()
  @ApiOperation({
    operationId: "boundingBoxGet",
    summary: "Get a bounding box for a polygon, site, project, or country/landscape"
  })
  @JsonApiResponse(BoundingBoxDto)
  async getBoundingBox(@Query() query: BoundingBoxQueryDto): Promise<JsonApiDocument> {
    let result: BoundingBoxDto;

    if (query.polygonUuid) {
      result = await this.boundingBoxService.getPolygonBoundingBox(query.polygonUuid);
      return buildJsonApi(BoundingBoxDto).addData(query.polygonUuid, result).document.serialize();
    }

    if (query.siteUuid) {
      result = await this.boundingBoxService.getSiteBoundingBox(query.siteUuid);
      return buildJsonApi(BoundingBoxDto).addData(query.siteUuid, result).document.serialize();
    }

    if (query.projectUuid) {
      result = await this.boundingBoxService.getProjectBoundingBox(query.projectUuid);
      return buildJsonApi(BoundingBoxDto).addData(query.projectUuid, result).document.serialize();
    }

    if (query.country || (query.landscapes && query.landscapes.length)) {
      result = await this.boundingBoxService.getCountryLandscapeBoundingBox(query.country, query.landscapes || []);
      // Generate a stable ID for this bounding box
      const id = `${query.country || "global"}-${(query.landscapes || []).join("-")}`;
      return buildJsonApi(BoundingBoxDto).addData(id, result).document.serialize();
    }

    throw new Error(
      "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, projectUuids, landscape, country, or country with landscapes."
    );
  }
}
