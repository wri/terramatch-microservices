import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { isEmpty } from "lodash";

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

    if (!isEmpty(query.polygonUuid)) {
      providedParams.push("polygonUuid");
    }

    if (!isEmpty(query.siteUuid)) {
      providedParams.push("siteUuid");
    }

    if (!isEmpty(query.projectUuid)) {
      providedParams.push("projectUuid");
    }

    const hasCountry = !isEmpty(query.country);
    const hasLandscapes = !isEmpty(query.landscapes) && Array.isArray(query.landscapes);

    if (hasCountry || hasLandscapes) {
      providedParams.push("country/landscapes");
    }

    if (providedParams.length > 1) {
      throw new BadRequestException(
        `Mutually exclusive parameters provided: ${providedParams.join(", ")}. Please provide only one entity type.`
      );
    }

    let result: BoundingBoxDto;

    if (!isEmpty(query.polygonUuid)) {
      const polygonUuid = query.polygonUuid as string;
      result = await this.boundingBoxService.getPolygonBoundingBox(polygonUuid);
      return buildJsonApi(BoundingBoxDto).addData(polygonUuid, result).document.serialize();
    }

    if (!isEmpty(query.siteUuid)) {
      const siteUuid = query.siteUuid as string;
      result = await this.boundingBoxService.getSiteBoundingBox(siteUuid);
      return buildJsonApi(BoundingBoxDto).addData(siteUuid, result).document.serialize();
    }

    if (!isEmpty(query.projectUuid)) {
      const projectUuid = query.projectUuid as string;
      result = await this.boundingBoxService.getProjectBoundingBox(projectUuid);
      return buildJsonApi(BoundingBoxDto).addData(projectUuid, result).document.serialize();
    }

    if (hasCountry || hasLandscapes) {
      const landscapes: string[] = hasLandscapes && Array.isArray(query.landscapes) ? query.landscapes : [];
      const country = hasCountry ? (query.country as string) : "global";

      result = await this.boundingBoxService.getCountryLandscapeBoundingBox(country, landscapes);
      const id = `${country}-${landscapes.join("-")}`;
      return buildJsonApi(BoundingBoxDto).addData(id, result).document.serialize();
    }

    throw new BadRequestException(
      "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, country, or landscapes."
    );
  }
}
