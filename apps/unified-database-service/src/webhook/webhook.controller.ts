import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Query,
  Request,
  UnauthorizedException
} from "@nestjs/common";
import { AirtableService } from "../airtable/airtable.service";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ApiException } from "@nanogiants/nestjs-swagger-api-exception-decorator";
import { UpdateRecordsQueryDto } from "./dto/update-records-query.dto";
import { Permission } from "@terramatch-microservices/database/entities";
import { DeleteRecordsQueryDto } from "./dto/delete-records-query.dto";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

  private async authorize(userId: number) {
    const permissions = await Permission.getUserPermissionNames(userId);
    // This isn't a perfect match for what this controller does, but it is close, and all admins have
    // this permission, so it's a reasonable way for now to restrict this controller to logged in
    // admins.
    if (!permissions.includes("reports-manage")) {
      throw new UnauthorizedException();
    }
  }

  @Get("updateRecords")
  @ApiOperation({
    operationId: "triggerAirtableUpdate",
    description: "trigger an update of a specific set of records to Airtable"
  })
  // This endpoint is not to be consumed by the TM FE and does not conform to our usual JSON API structure
  @ApiResponse({
    status: HttpStatus.OK,
    schema: { type: "object", properties: { status: { type: "string", example: "OK" } } }
  })
  @ApiException(() => UnauthorizedException, { description: "Authorization failed" })
  @ApiException(() => BadRequestException, { description: "Query params were invalid" })
  async updateRecords(@Query() { entityType, startPage }: UpdateRecordsQueryDto, @Request() { authenticatedUserId }) {
    await this.authorize(authenticatedUserId);
    await this.airtableService.updateAirtableJob(entityType, startPage);

    return { status: "OK" };
  }

  @Get("deleteRecords")
  @ApiOperation({
    operationId: "triggerAirtableDelete",
    description: "trigger a delete of a specific set of soft-deleted records from Airtable"
  })
  // This endpoint is not to be consumed by the TM FE and does not conform to our usual JSON API structure
  @ApiResponse({
    status: HttpStatus.OK,
    schema: { type: "object", properties: { status: { type: "string", example: "OK" } } }
  })
  @ApiException(() => UnauthorizedException, { description: "Authorization failed" })
  @ApiException(() => BadRequestException, { description: "Query params were invalid" })
  async removeDeletedRecords(
    @Query() { entityType, deletedSince }: DeleteRecordsQueryDto,
    @Request() { authenticatedUserId }
  ) {
    await this.authorize(authenticatedUserId);
    await this.airtableService.deleteAirtableJob(entityType, deletedSince);

    return { status: "OK" };
  }
}
