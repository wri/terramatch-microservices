import { BadRequestException, Controller, Get, HttpStatus, Query, UnauthorizedException } from "@nestjs/common";
import { AirtableService } from "../airtable/airtable.service";
import { ENTITY_TYPES } from "../airtable/airtable.processor";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ApiException } from "@nanogiants/nestjs-swagger-api-exception-decorator";
import { WebhookParamsDto } from "./dto/webhook-params.dto";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

  @Get()
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
  async triggerWebhook(@Query() { entityType, startPage }: WebhookParamsDto) {
    if (entityType == null) {
      throw new BadRequestException("Missing query params");
    }

    if (!ENTITY_TYPES.includes(entityType)) {
      throw new BadRequestException("entityType invalid");
    }

    await this.airtableService.updateAirtableJob(entityType, startPage);

    return { status: "OK" };
  }
}
