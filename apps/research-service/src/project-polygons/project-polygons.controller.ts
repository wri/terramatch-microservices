import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { ProjectPolygonQueryDto } from "./dto/project-polygon-query.dto";
import { CreateProjectPolygonJsonApiRequestDto } from "./dto/create-project-polygon-request.dto";
import { ProjectPolygonsService } from "./project-polygons.service";
import { ProjectPolygonCreationService } from "./project-polygon-creation.service";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";

@Controller("research/v3/projectPolygons")
export class ProjectPolygonsController {
  constructor(
    private readonly projectPolygonService: ProjectPolygonsService,
    private readonly projectPolygonCreationService: ProjectPolygonCreationService,
    private readonly policyService: PolicyService
  ) {}

  private readonly logger = new Logger(ProjectPolygonsController.name);

  @Get()
  @ApiOperation({
    operationId: "getProjectPolygon",
    summary: "Get project polygon by project pitch UUID",
    description: `Get the project polygon for a specific project pitch. Only one polygon per project pitch is supported.`
  })
  @JsonApiResponse(ProjectPolygonDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid query parameters." })
  @ExceptionResponse(NotFoundException, { description: "Project polygon or project pitch not found." })
  async findOne(@Query() query: ProjectPolygonQueryDto) {
    await this.policyService.authorize("read", ProjectPolygon);

    if (query.projectPitchUuid == null) {
      throw new BadRequestException("projectPitchUuid query parameter is required");
    }

    const projectPolygon = await this.projectPolygonService.findByProjectPitchUuid(query.projectPitchUuid);

    if (projectPolygon == null) {
      throw new NotFoundException(`Project polygon not found for project pitch: ${query.projectPitchUuid}`);
    }

    const document = buildJsonApi(ProjectPolygonDto);
    const dto = await this.projectPolygonService.buildDto(projectPolygon, query.projectPitchUuid);
    document.addData(projectPolygon.uuid, dto);

    return document;
  }

  @Post()
  @ApiOperation({
    operationId: "createProjectPolygon",
    summary: "Create project polygon from GeoJSON",
    description: `Create a project polygon for a project pitch from GeoJSON.
    
    Each feature must have \`projectPitchUuid\` in properties.
    Only one polygon per project pitch is supported. If a polygon already exists for the project pitch, the request will fail.`
  })
  @JsonApiResponse(ProjectPolygonDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid request data, project pitch not found, or polygon already exists for project pitch."
  })
  async create(@Body() createRequest: CreateProjectPolygonJsonApiRequestDto) {
    await this.policyService.authorize("create", ProjectPolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const geometries = createRequest?.data?.attributes?.geometries;

    if (geometries == null || geometries.length === 0) {
      throw new BadRequestException("geometries array is required");
    }

    const batchRequest = { geometries };

    const createdProjectPolygons = await this.projectPolygonCreationService.createProjectPolygons(batchRequest, userId);

    const document = buildJsonApi(ProjectPolygonDto);

    const projectPitchMap = await this.projectPolygonService.loadProjectPitchAssociation(createdProjectPolygons);

    for (const projectPolygon of createdProjectPolygons) {
      const projectPitchUuid = projectPitchMap[projectPolygon.entityId];
      const dto = await this.projectPolygonService.buildDto(projectPolygon, projectPitchUuid);
      document.addData(projectPolygon.uuid, dto);
    }

    this.logger.log(`Created ${createdProjectPolygons.length} project polygon(s) by user ${userId}`);

    return document;
  }
}
