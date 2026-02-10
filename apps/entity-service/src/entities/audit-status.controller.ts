import { Body, Controller, Delete, Get, NotFoundException, Param, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { AuditStatusService } from "./audit-status.service";
import { AuditStatusParamsDto, AuditStatusDeleteParamsDto } from "./dto/audit-status-params.dto";
import { AuditStatusDto, CreateAuditStatusBody } from "./dto/audit-status.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import { EntitiesService } from "./entities.service";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";

@Controller("entities/v3/auditStatuses")
export class AuditStatusController {
  constructor(
    private readonly auditStatusService: AuditStatusService,
    private readonly policyService: PolicyService,
    private readonly entitiesService: EntitiesService
  ) {}

  @Get(":entity/:uuid")
  @ApiOperation({
    operationId: "getAuditStatuses",
    summary: "Get audit status history for an entity"
  })
  @JsonApiResponse({ data: AuditStatusDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  async getAuditStatuses(@Param() { entity, uuid }: AuditStatusParamsDto) {
    const baseEntity = await this.auditStatusService.resolveEntity(entity, uuid);
    await this.policyService.authorize("read", baseEntity);
    const auditStatuses = await this.auditStatusService.getAuditStatuses(baseEntity, entity, uuid);
    const document = buildJsonApi(AuditStatusDto, { forceDataArray: true });
    const indexIds: string[] = [];
    for (const auditStatus of auditStatuses) {
      indexIds.push(auditStatus.uuid);
      document.addData(auditStatus.uuid, auditStatus);
    }

    document.addIndex({
      resource: getDtoType(AuditStatusDto),
      requestPath: `/entities/v3/auditStatuses/${entity}/${uuid}`,
      ids: indexIds
    });

    return document;
  }

  @Post(":entity/:uuid")
  @ApiOperation({
    operationId: "createAuditStatus",
    summary: "Create a new audit status for an entity"
  })
  @JsonApiResponse({ data: AuditStatusDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async createAuditStatus(
    @Param() { entity, uuid }: AuditStatusParamsDto,
    @Body() createPayload: CreateAuditStatusBody
  ) {
    if (createPayload.data.type !== "auditStatuses") {
      throw new BadRequestException("Payload type must be 'auditStatuses'");
    }

    const baseEntity = await this.auditStatusService.resolveEntity(entity, uuid);
    await this.policyService.authorize("read", baseEntity);

    const auditStatus = await this.auditStatusService.createAuditStatus(baseEntity, createPayload.data.attributes);

    const attachments = await Media.for(auditStatus).collection("attachments").findAll();
    const attachmentDtos = attachments.map(media =>
      this.entitiesService.mediaDto(media, { entityType: entity, entityUuid: uuid } as {
        entityType: EntityType;
        entityUuid: string;
      })
    );

    const dto = AuditStatusDto.fromAuditStatus(auditStatus, attachmentDtos);
    const document = buildJsonApi(AuditStatusDto);
    document.addData(auditStatus.uuid, dto);

    return document;
  }

  @Delete(":entity/:uuid/:auditUuid")
  @ApiOperation({
    operationId: "deleteAuditStatus",
    summary: "Delete an audit status for an entity",
    description:
      "Soft deletes an audit status by UUID. The audit status must belong to the specified entity. " +
      "Requires authentication and appropriate permissions."
  })
  @JsonApiDeletedResponse(getDtoType(AuditStatusDto), {
    description: "Audit status was deleted"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, {
    description: "Entity or audit status not found, or audit status does not belong to the entity."
  })
  async deleteAuditStatus(@Param() { entity, uuid, auditUuid }: AuditStatusDeleteParamsDto) {
    const baseEntity = await this.auditStatusService.resolveEntity(entity, uuid);
    await this.policyService.authorize("delete", baseEntity);

    await this.auditStatusService.deleteAuditStatus(auditUuid);

    return buildDeletedResponse(getDtoType(AuditStatusDto), auditUuid);
  }
}
