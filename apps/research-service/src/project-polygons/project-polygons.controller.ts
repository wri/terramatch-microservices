import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { ProjectPolygonQueryDto } from "./dto/project-polygon-query.dto";
import { CreateProjectPolygonJsonApiRequestDto } from "./dto/create-project-polygon-request.dto";
import { UpdateProjectPolygonRequestDto } from "./dto/update-project-polygon-request.dto";
import { ProjectPolygonUploadRequestDto } from "./dto/project-polygon-upload.dto";
import { ProjectPolygonsService } from "./project-polygons.service";
import { ProjectPolygonCreationService } from "./project-polygon-creation.service";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import { GeoJsonExportDto } from "../geojson-export/dto/geojson-export.dto";
import { ProjectPolygonGeoJsonQueryDto } from "./dto/project-polygon-geojson-query.dto";
import "multer";

@Controller("research/v3/projectPolygons")
@ApiExtraModels(GeoJsonExportDto)
export class ProjectPolygonsController {
  constructor(
    private readonly projectPolygonService: ProjectPolygonsService,
    private readonly projectPolygonCreationService: ProjectPolygonCreationService,
    private readonly policyService: PolicyService
  ) {}

  private readonly logger = new Logger(ProjectPolygonsController.name);

  @Get("geojson")
  @ApiOperation({
    operationId: "getProjectPolygonGeoJson",
    summary: "Export project polygon as GeoJSON",
    description: `Export a project polygon as GeoJSON FeatureCollection for a specific project pitch.`
  })
  @JsonApiResponse(GeoJsonExportDto)
  @ExceptionResponse(BadRequestException, {
    description: "Invalid query parameters (projectPitchUuid is required)"
  })
  @ExceptionResponse(NotFoundException, {
    description: "Project polygon, project pitch, or polygon geometry not found"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed"
  })
  async getGeoJson(@Query() query: ProjectPolygonGeoJsonQueryDto) {
    await this.policyService.authorize("read", ProjectPolygon);

    const featureCollection = await this.projectPolygonService.getGeoJson(query);

    const document = buildJsonApi(GeoJsonExportDto);

    return document.addData(query.projectPitchUuid, new GeoJsonExportDto(featureCollection));
  }

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
    document.addData(getStableRequestQuery(query), dto);

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
  @Patch(":polyUuid")
  @ApiOperation({
    operationId: "updateProjectPolygon",
    summary: "Update project polygon geometry by polygon geometry UUID",
    description: `Update the geometry of an existing project polygon using the polygon geometry UUID (polyUuid).
    
    The polygon geometry will be updated in place with the new geometry provided in the request.
    The polyUuid remains the same - only the geometry data is updated.
    The project pitch association remains unchanged.`
  })
  @JsonApiResponse(ProjectPolygonDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, {
    description: "Project polygon not found for the given polygon geometry UUID."
  })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data or geometry." })
  async update(@Param("polyUuid") polyUuid: string, @Body() updateRequest: UpdateProjectPolygonRequestDto) {
    if (polyUuid !== updateRequest.data.id) {
      throw new BadRequestException("Polygon geometry UUID in path and payload do not match");
    }

    const projectPolygon = await this.projectPolygonService.findByPolyUuid(polyUuid);

    if (projectPolygon === null) {
      throw new NotFoundException(`Project polygon not found for polygon geometry UUID: ${polyUuid}`);
    }

    await this.policyService.authorize("update", projectPolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const geometries = updateRequest?.data?.attributes?.geometries;

    if (geometries == null || geometries.length === 0) {
      throw new BadRequestException("geometries array is required");
    }

    const updatedProjectPolygon = await this.projectPolygonCreationService.updateProjectPolygon(
      projectPolygon,
      geometries,
      userId
    );

    const document = buildJsonApi(ProjectPolygonDto);

    const projectPitchMap = await this.projectPolygonService.loadProjectPitchAssociation([updatedProjectPolygon]);
    const projectPitchUuid = projectPitchMap[updatedProjectPolygon.entityId];

    const dto = await this.projectPolygonService.buildDto(updatedProjectPolygon, projectPitchUuid);
    document.addData(updatedProjectPolygon.uuid, dto);

    this.logger.log(`Updated project polygon with polyUuid ${polyUuid} by user ${userId}`);

    return document;
  }

  @Delete(":polyUuid")
  @ApiOperation({
    operationId: "deleteProjectPolygon",
    summary: "Delete a project polygon and its polygon geometry by polygon geometry UUID",
    description: `Soft deletes a project polygon and its associated polygon geometry record using the polygon geometry UUID (polyUuid).`
  })
  @JsonApiDeletedResponse(getDtoType(ProjectPolygonDto), {
    description: "Project polygon and all associated records were deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, {
    description: "Project polygon not found for the given polygon geometry UUID."
  })
  async delete(@Param("polyUuid") polyUuid: string) {
    const projectPolygon = await this.projectPolygonService.findByPolyUuid(polyUuid);

    if (projectPolygon === null) {
      throw new NotFoundException(`Project polygon not found for polygon geometry UUID: ${polyUuid}`);
    }

    await this.policyService.authorize("delete", projectPolygon);

    await this.projectPolygonService.deleteProjectPolygon(projectPolygon);

    this.logger.log(`Deleted project polygon with polyUuid ${polyUuid}`);

    return buildDeletedResponse(getDtoType(ProjectPolygonDto), polyUuid);
  }
}
