import {
  BadRequestException,
  Controller,
  Delete,
  NotFoundException,
  Param,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { MediaDto } from "../entities/dto/media.dto";
import { ApiOperation } from "@nestjs/swagger";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { buildDeletedResponse } from "@terramatch-microservices/common/util/json-api-builder";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Controller("entities/v3/medias")
export class MediasController {
  private logger = new TMLogger(MediasController.name);

  constructor(private readonly mediaService: MediaService, private readonly policyService: PolicyService) {}

  @Delete(":uuid")
  @ApiOperation({
    operationId: "mediaDelete",
    summary: "Delete a media by uuid"
  })
  @JsonApiResponse({ data: MediaDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async mediaDelete(@Param() { uuid }: { uuid: string }) {
    this.logger.log(`Deleting media ${uuid}`);
    const media = await this.mediaService.getMedia(uuid);
    await this.policyService.authorize("deleteFiles", media);
    await this.mediaService.deleteMedia(uuid);
    return buildDeletedResponse("medias", uuid);
  }

  @Delete()
  @ApiOperation({
    operationId: "mediaBulkDelete",
    summary: "Delete multiple media"
  })
  @JsonApiResponse({ data: MediaDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async mediaBulkDelete(@Query() { uuids }: { uuids: string[] }) {
    await this.mediaService.bulkDeleteMedia(uuids);
  }
}
