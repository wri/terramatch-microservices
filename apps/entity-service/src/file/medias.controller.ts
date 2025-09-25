import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
  UnauthorizedException
} from "@nestjs/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { MediaDto } from "../entities/dto/media.dto";
import { ApiOperation } from "@nestjs/swagger";
import { SingleMediaDto } from "../entities/dto/media-query.dto";
import { MediaUpdateBody } from "../entities/dto/media-update.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";

@Controller("entities/v3/medias")
export class MediasController {
  constructor(private readonly mediaService: MediaService, private readonly policyService: PolicyService) {}

  @Patch(":uuid")
  @ApiOperation({
    operationId: "mediaUpdate",
    summary: "Update a media by uuid"
  })
  @JsonApiResponse({ data: MediaDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  async mediaUpdate(@Param() { uuid }: SingleMediaDto, @Body() updatePayload: MediaUpdateBody) {
    const media = await this.mediaService.getMedia(uuid);

    // await this.policyService.authorize("update", media);

    return this.mediaService.updateMedia(media, updatePayload);
  }
}
