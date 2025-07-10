import { Controller, Get, Query, BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { isEmpty } from "lodash";
import { PolicyService } from "@terramatch-microservices/common";
import {
  Project,
  Site,
  SitePolygon,
  LandscapeGeometry,
  ProjectPitch
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

type ParameterType = "polygonUuid" | "siteUuid" | "projectUuid" | "projectPitchUuid" | "country/landscapes";

@Controller("boundingBoxes/v3")
@ApiTags("Bounding Boxes")
export class BoundingBoxController {
  constructor(private readonly boundingBoxService: BoundingBoxService, private readonly policyService: PolicyService) {}

  @Get("get")
  @ApiOperation({
    operationId: "boundingBoxGet",
    summary: "Get a bounding box for a polygon, site, project, project pitch, or country/landscape"
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

    if (!isEmpty(query.projectPitchUuid)) {
      providedParams.push("projectPitchUuid");
    }

    const hasCountry = !isEmpty(query.country);
    const hasLandscapes = !isEmpty(query.landscapes);

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
        "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, projectPitchUuid, country, or landscapes."
      );
    }

    switch (providedParams[0]) {
      case "polygonUuid": {
        const polygonUuid = query.polygonUuid ?? "";
        const site = await Site.findOne({
          where: {
            uuid: {
              [Op.in]: Subquery.select(SitePolygon, "siteUuid").eq("polygonUuid", polygonUuid).literal
            }
          },
          attributes: ["frameworkKey", "projectId"]
        });

        if (site === null) {
          throw new NotFoundException(`Site with associated polygon UUID ${polygonUuid} not found`);
        }

        await this.policyService.authorize("read", site);

        const result = await this.boundingBoxService.getPolygonBoundingBox(polygonUuid);
        return buildJsonApi(BoundingBoxDto).addData(polygonUuid, result).document.serialize();
      }

      case "siteUuid": {
        const siteUuid = query.siteUuid ?? "";

        const site = await Site.findOne({
          where: { uuid: siteUuid },
          attributes: ["frameworkKey", "projectId"]
        });

        if (site === null) {
          throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
        }

        await this.policyService.authorize("read", site);

        const result = await this.boundingBoxService.getSiteBoundingBox(siteUuid);
        return buildJsonApi(BoundingBoxDto).addData(siteUuid, result).document.serialize();
      }

      case "projectUuid": {
        const projectUuid = query.projectUuid ?? "";

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

      case "projectPitchUuid": {
        const projectPitchUuid = query.projectPitchUuid ?? "";

        const projectPitch = await ProjectPitch.findOne({
          where: { uuid: projectPitchUuid },
          attributes: ["id", "uuid", "organisationId"]
        });

        if (projectPitch === null) {
          throw new NotFoundException(`Project pitch with UUID ${projectPitchUuid} not found`);
        }

        const result = await this.boundingBoxService.getProjectPitchBoundingBox(projectPitchUuid);
        return buildJsonApi(BoundingBoxDto).addData(projectPitchUuid, result).document.serialize();
      }

      case "country/landscapes": {
        const country = query.country;
        const landscapes: string[] = query.landscapes ?? [];

        if (landscapes.length > 0) {
          const validLandscapes = LandscapeGeometry.LANDSCAPE_SLUGS;
          const invalidLandscapes = landscapes.filter(
            landscape => !validLandscapes.some(validSlug => validSlug === landscape)
          );
          if (invalidLandscapes.length > 0) {
            throw new BadRequestException(
              `Invalid landscape slugs provided: ${invalidLandscapes.join(
                ", "
              )}. Valid landscape slugs are: ${validLandscapes.join(", ")}`
            );
          }
        }

        const result = await this.boundingBoxService.getCountryLandscapeBoundingBox(country ?? "", landscapes);

        let id: string;
        if (!isEmpty(country) && landscapes.length > 0) {
          id = `${country},${landscapes.join(",")}`;
        } else if (!isEmpty(country)) {
          id = country as string;
        } else {
          id = landscapes.join(",");
        }
        return buildJsonApi(BoundingBoxDto).addData(id, result).document.serialize();
      }
    }
  }
}
