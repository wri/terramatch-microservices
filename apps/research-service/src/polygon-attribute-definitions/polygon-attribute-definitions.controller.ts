import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiParam } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { PolygonAttributeDefinition } from "@terramatch-microservices/database/entities";
import { PolygonAttributeDefinitionQueryDto } from "./dto/polygon-attribute-definition-query.dto";
import {
  CreatePolygonAttributeDefinitionBody,
  PolygonAttributeDefinitionConstants,
  PolygonAttributeDefinitionDto,
  UpdatePolygonAttributeDefinitionBody
} from "./dto/polygon-attribute-definition.dto";
import { PolygonAttributeDefinitionsService } from "./polygon-attribute-definitions.service";

@Controller("research/v3/polygonAttributeDefinitions")
@ApiExtraModels(PolygonAttributeDefinitionConstants)
export class PolygonAttributeDefinitionsController {
  constructor(
    private readonly polygonAttributeDefinitionsService: PolygonAttributeDefinitionsService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "polygonAttributeDefinitionsIndex",
    summary: "List polygon attribute definitions for a framework (admin only)",
    description:
      "Returns all definitions for the given framework, including inactive ones. Champion write APIs still ignore inactive definitions."
  })
  @JsonApiResponse({ data: PolygonAttributeDefinitionDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to access polygon attribute definitions"
  })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: PolygonAttributeDefinitionQueryDto) {
    const definitions = await this.polygonAttributeDefinitionsService.findAll(query.frameworkKey);
    await this.policyService.authorize(
      "read",
      definitions.length > 0 ? definitions : this.policySubject(query.frameworkKey)
    );

    const document = buildJsonApi(PolygonAttributeDefinitionDto, { forceDataArray: true }).addIndex({
      requestPath: `/research/v3/polygonAttributeDefinitions${getStableRequestQuery(query)}`
    });
    return await this.polygonAttributeDefinitionsService.addDtos(document, definitions);
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "polygonAttributeDefinitionGet",
    summary: "Get a polygon attribute definition by uuid (admin only)"
  })
  @ApiParam({ name: "uuid", type: String, format: "uuid" })
  @JsonApiResponse(PolygonAttributeDefinitionDto)
  @ExceptionResponse(NotFoundException, { description: "Polygon attribute definition not found" })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to access this polygon attribute definition"
  })
  async get(@Param("uuid") uuid: string) {
    const definition = await this.polygonAttributeDefinitionsService.findOne(uuid);
    await this.policyService.authorize("read", definition);
    return await this.polygonAttributeDefinitionsService.addDto(
      buildJsonApi(PolygonAttributeDefinitionDto),
      definition
    );
  }

  @Post()
  @ApiOperation({
    operationId: "polygonAttributeDefinitionCreate",
    summary: "Create a polygon attribute definition (admin only)",
    description:
      "The stable key is generated from the label (camelCase) and cannot be set by the client. It is locked after create."
  })
  @JsonApiResponse(PolygonAttributeDefinitionDto)
  @ExceptionResponse(UnauthorizedException, { description: "Polygon attribute definition creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Payload malformed or key is duplicate/reserved." })
  async create(@Body() payload: CreatePolygonAttributeDefinitionBody) {
    const attributes = payload.data.attributes;
    await this.policyService.authorize("create", this.policySubject(attributes.frameworkKey));
    const definition = await this.polygonAttributeDefinitionsService.create(attributes);
    return await this.polygonAttributeDefinitionsService.addDto(
      buildJsonApi(PolygonAttributeDefinitionDto),
      definition
    );
  }

  @Put(":uuid")
  @ApiOperation({
    operationId: "polygonAttributeDefinitionUpdate",
    summary: "Update a polygon attribute definition (admin only)",
    description:
      "Label, active, and options may change. Key, framework, and input type cannot. When options are sent, the list is replaced. An omitted option is rejected if any polygon still stores that value."
  })
  @ApiParam({ name: "uuid", type: String, format: "uuid" })
  @JsonApiResponse(PolygonAttributeDefinitionDto)
  @ExceptionResponse(NotFoundException, { description: "Polygon attribute definition not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Polygon attribute definition update not allowed." })
  @ExceptionResponse(BadRequestException, {
    description: "Payload malformed, path/body ids do not match, or an omitted option is still stored on a polygon."
  })
  async update(@Param("uuid") uuid: string, @Body() payload: UpdatePolygonAttributeDefinitionBody) {
    if (payload.data.id != null && payload.data.id !== uuid) {
      throw new BadRequestException("Polygon attribute definition id in path and payload do not match");
    }
    const definition = await this.polygonAttributeDefinitionsService.findOne(uuid);
    await this.policyService.authorize("update", definition);
    const updated = await this.polygonAttributeDefinitionsService.update(definition, payload.data.attributes);
    return await this.polygonAttributeDefinitionsService.addDto(buildJsonApi(PolygonAttributeDefinitionDto), updated);
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "polygonAttributeDefinitionDelete",
    summary: "Delete a polygon attribute definition if unused (admin only)",
    description:
      "Hard-deletes the definition and its options only when no polygon values exist. If values exist, deactivate the definition instead."
  })
  @ApiParam({ name: "uuid", type: String, format: "uuid" })
  @JsonApiDeletedResponse(getDtoType(PolygonAttributeDefinitionDto), {
    description: "Polygon attribute definition was deleted"
  })
  @ExceptionResponse(NotFoundException, { description: "Polygon attribute definition not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Polygon attribute definition delete not allowed." })
  @ExceptionResponse(BadRequestException, {
    description: "Definition has polygon values and cannot be deleted"
  })
  async delete(@Param("uuid") uuid: string) {
    const definition = await this.polygonAttributeDefinitionsService.findOne(uuid);
    await this.policyService.authorize("delete", definition);
    await this.polygonAttributeDefinitionsService.delete(definition);
    return buildDeletedResponse(getDtoType(PolygonAttributeDefinitionDto), uuid);
  }

  private policySubject(frameworkKey: PolygonAttributeDefinition["frameworkKey"]) {
    return PolygonAttributeDefinition.build({
      frameworkKey,
      key: "unused",
      label: "unused",
      inputType: "single_select"
    });
  }
}
