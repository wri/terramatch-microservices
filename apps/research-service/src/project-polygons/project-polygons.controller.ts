import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { ProjectPolygonQueryDto } from "./dto/project-polygon-query.dto";
import { CreateProjectPolygonJsonApiRequestDto } from "./dto/create-project-polygon-request.dto";
import { ProjectPolygonUploadRequestDto } from "./dto/project-polygon-upload.dto";
import { ProjectPolygonsService } from "./project-polygons.service";
import { ProjectPolygonCreationService } from "./project-polygon-creation.service";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import "multer";

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

  @Post("upload")
  @ApiOperation({
    operationId: "uploadProjectPolygonFile",
    summary: "Upload geometry file to create project polygon",
    description: `Upload a geometry file (KML, Shapefile, or GeoJSON) to create a project polygon.
    
    Supported formats: KML (.kml), Shapefile (.zip with .shp/.shx/.dbf), GeoJSON (.geojson)
    
    Geometry transformation rules:
    - Single point: Creates a circular polygon using est_area
    - Two or more points: Uses Voronoi transformation, then convex hull to merge
    - Multiple features (mixed geometries): Creates a convex hull encompassing all features
    - Single polygon/line: Uses the geometry as-is
    
    
    If a project polygon already exists for the project pitch, it will be replaced.`
  })
  @UseInterceptors(FileInterceptor("file"), FormDtoInterceptor)
  @JsonApiResponse(ProjectPolygonDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid file format, file parsing failed, or no features found in file."
  })
  @ExceptionResponse(NotFoundException, { description: "Project pitch not found." })
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body() payload: ProjectPolygonUploadRequestDto) {
    await this.policyService.authorize("create", ProjectPolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const projectPitchUuid = payload.data.attributes.projectPitchUuid;

    const createdProjectPolygon = await this.projectPolygonCreationService.uploadProjectPolygonFromFile(
      file,
      projectPitchUuid,
      userId
    );

    const document = buildJsonApi(ProjectPolygonDto);
    const dto = await this.projectPolygonService.buildDto(createdProjectPolygon, projectPitchUuid);
    document.addData(createdProjectPolygon.uuid, dto);
    return document;
  }
  @Delete(":uuid")
  @ApiOperation({
    operationId: "deleteProjectPolygon",
    summary: "Delete a project polygon and its polygon geometry",
    description: `Soft deletes a project polygon and its associated polygon geometry record.`
  })
  @JsonApiDeletedResponse(getDtoType(ProjectPolygonDto), {
    description: "Project polygon and all associated records were deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Project polygon not found." })
  async delete(@Param("uuid") uuid: string) {
    const projectPolygon = await this.projectPolygonService.findOne(uuid);

    if (projectPolygon === null) {
      throw new NotFoundException(`Project polygon not found for uuid: ${uuid}`);
    }

    await this.policyService.authorize("delete", projectPolygon);

    await this.projectPolygonService.deleteProjectPolygon(projectPolygon);

    this.logger.log(`Deleted project polygon ${uuid}`);

    return buildDeletedResponse(getDtoType(ProjectPolygonDto), uuid);
  }
}
