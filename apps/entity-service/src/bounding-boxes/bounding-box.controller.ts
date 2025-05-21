import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";

@Controller("boundingBoxes/v3")
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
    const providedParams: string[] = [];

    if (query.polygonUuid !== undefined && query.polygonUuid !== null && query.polygonUuid !== "") {
      providedParams.push("polygonUuid");
    }

    if (query.siteUuid !== undefined && query.siteUuid !== null && query.siteUuid !== "") {
      providedParams.push("siteUuid");
    }

    if (query.projectUuid !== undefined && query.projectUuid !== null && query.projectUuid !== "") {
      providedParams.push("projectUuid");
    }

    const hasCountry = query.country !== undefined && query.country !== null && query.country !== "";
    const hasLandscapes =
      query.landscapes !== undefined &&
      query.landscapes !== null &&
      Array.isArray(query.landscapes) &&
      query.landscapes.length > 0;

    if (hasCountry || hasLandscapes) {
      providedParams.push("country/landscapes");
    }

    if (providedParams.length > 1) {
      throw new BadRequestException(
        `Mutually exclusive parameters provided: ${providedParams.join(", ")}. Please provide only one entity type.`
      );
    }

    let result: BoundingBoxDto;

    if (query.polygonUuid !== undefined && query.polygonUuid !== null && query.polygonUuid !== "") {
      result = await this.boundingBoxService.getPolygonBoundingBox(query.polygonUuid);
      return buildJsonApi(BoundingBoxDto).addData(query.polygonUuid, result).document.serialize();
    }

    if (query.siteUuid !== undefined && query.siteUuid !== null && query.siteUuid !== "") {
      result = await this.boundingBoxService.getSiteBoundingBox(query.siteUuid);
      return buildJsonApi(BoundingBoxDto).addData(query.siteUuid, result).document.serialize();
    }

    if (query.projectUuid !== undefined && query.projectUuid !== null && query.projectUuid !== "") {
      result = await this.boundingBoxService.getProjectBoundingBox(query.projectUuid);
      return buildJsonApi(BoundingBoxDto).addData(query.projectUuid, result).document.serialize();
    }

    if (hasCountry || hasLandscapes) {
      const landscapes: string[] = hasLandscapes && Array.isArray(query.landscapes) ? query.landscapes : [];
      const country = hasCountry ? query.country : "global";

      result = await this.boundingBoxService.getCountryLandscapeBoundingBox(country as string, landscapes);
      const id = `${country}-${landscapes.join("-")}`;
      return buildJsonApi(BoundingBoxDto).addData(id, result).document.serialize();
    }

    throw new BadRequestException(
      "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, country, or landscapes."
    );
  }
}
