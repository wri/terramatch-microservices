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
import { WebhookParamsDto } from "./dto/webhook-params.dto";
import { Permission } from "@terramatch-microservices/database/entities";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

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
  async updateRecords(@Query() { entityType, startPage }: WebhookParamsDto, @Request() { authenticatedUserId }) {
    const permissions = await Permission.getUserPermissionNames(authenticatedUserId);
    // This isn't a perfect match for what this controller does, but it is close, and all admins have
    // this permission, so it's a reasonable way for now to restrict this controller to logged in
    // admins.
    if (!permissions.includes("reports-manage")) {
      throw new UnauthorizedException();
    }

    await this.airtableService.updateAirtableJob(entityType, startPage);

    return { status: "OK" };
  }
}
