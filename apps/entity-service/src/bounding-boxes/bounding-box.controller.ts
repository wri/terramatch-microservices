import { Controller, Get, Query, BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { isEmpty } from "lodash";
import { PolicyService } from "@terramatch-microservices/common";
import { PolygonGeometry, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";

type ParameterType = "polygonUuid" | "siteUuid" | "projectUuid" | "country/landscapes";

@Controller("boundingBoxes/v3")
@ApiTags("Bounding Boxes")
export class BoundingBoxController {
  constructor(private readonly boundingBoxService: BoundingBoxService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "boundingBoxGet",
    summary: "Get a bounding box for a polygon, site, project, or country/landscape"
  })
  @JsonApiResponse(BoundingBoxDto)
  @ExceptionResponse(BadRequestException, {
    description: "Invalid or multiple exclusive parameters provided"
  })
  @ExceptionResponse(NotFoundException, {
    description: "Requested resource not found"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to view this resource"
  })
  async getBoundingBox(@Query() query: BoundingBoxQueryDto): Promise<JsonApiDocument> {
    const providedParams: ParameterType[] = [];

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

    if (providedParams.length === 0) {
      throw new BadRequestException(
        "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, country, or landscapes."
      );
    }

    switch (providedParams[0]) {
      case "polygonUuid": {
        const polygonUuid = query.polygonUuid as string;
        const sitePolygon = await SitePolygon.findOne({
          where: { polygonUuid },
          attributes: ["id", "uuid", "siteUuid", "polygonUuid"]
        });

        if (sitePolygon !== null) {
          await this.policyService.authorize("read", sitePolygon);

          const result = await this.boundingBoxService.getPolygonBoundingBox(polygonUuid);
          return buildJsonApi(BoundingBoxDto).addData(polygonUuid, result).document.serialize();
        } else {
          const polygon = await PolygonGeometry.findOne({
            where: { uuid: polygonUuid },
            attributes: ["uuid"]
          });

          if (polygon === null) {
            throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
          }
          await this.policyService.authorize("read", polygon);

          const result = await this.boundingBoxService.getPolygonBoundingBox(polygonUuid);
          return buildJsonApi(BoundingBoxDto).addData(polygonUuid, result).document.serialize();
        }
      }

      case "siteUuid": {
        const siteUuid = query.siteUuid as string;

        const site = await Site.findOne({
          where: { uuid: siteUuid },
          include: [
            {
              association: "project",
              attributes: ["id", "uuid", "frameworkKey"]
            }
          ]
        });

        if (site === null) {
          throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
        }

        await this.policyService.authorize("read", site);

        const result = await this.boundingBoxService.getSiteBoundingBox(siteUuid);
        return buildJsonApi(BoundingBoxDto).addData(siteUuid, result).document.serialize();
      }

      case "projectUuid": {
        const projectUuid = query.projectUuid as string;

        const project = await Project.findOne({
          where: { uuid: projectUuid },
          attributes: ["id", "uuid", "frameworkKey", "organisationId"]
        });

        if (project === null) {
          throw new NotFoundException(`Project with UUID ${projectUuid} not found`);
        }

        await this.policyService.authorize("read", project);

        const result = await this.boundingBoxService.getProjectBoundingBox(projectUuid);
        return buildJsonApi(BoundingBoxDto).addData(projectUuid, result).document.serialize();
      }

      case "country/landscapes": {
        const landscapes: string[] = hasLandscapes && Array.isArray(query.landscapes) ? query.landscapes : [];
        const country = hasCountry ? (query.country as string) : "global";

        const result = await this.boundingBoxService.getCountryLandscapeBoundingBox(country, landscapes);
        const id = `${country}-${landscapes.join("-")}`;
        return buildJsonApi(BoundingBoxDto).addData(id, result).document.serialize();
      }
    }
  }
}
