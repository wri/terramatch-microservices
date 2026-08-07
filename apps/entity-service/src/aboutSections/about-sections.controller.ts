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
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import {
  AboutSectionConstants,
  AboutSectionDto,
  CreateAboutSectionBody,
  UpdateAboutSectionBody
} from "./dto/about-section.dto";
import { AboutSectionsService } from "./about-sections.service";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { AboutSection } from "@terramatch-microservices/database/entities";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";

@Controller("aboutSections/v3/aboutSections")
@ApiExtraModels(AboutSectionConstants)
export class AboutSectionsController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly aboutSectionsService: AboutSectionsService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "aboutSectionIndex",
    description:
      "Get a paginated and filtered list of about sections. If a type and framework key are included, the result will be a single section"
  })
  @JsonApiResponse({ data: AboutSectionDto, pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: AboutSectionIndexQueryDto) {
    return await this.aboutSectionsService.addIndex(
      buildJsonApi<AboutSectionDto>(AboutSectionDto, { pagination: "number" }),
      query
    );
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "aboutSectionGet",
    description: "Get an about section by uuid"
  })
  @JsonApiResponse(AboutSectionDto)
  @ExceptionResponse(NotFoundException, { description: "About section for this type not found" })
  async get(@Param() { uuid }: SingleResourceDto) {
    const aboutSection = await AboutSection.findOne({ where: { uuid } });
    if (aboutSection == null) throw new NotFoundException();

    return this.aboutSectionsService.addDto(buildJsonApi<AboutSectionDto>(AboutSectionDto), aboutSection);
  }

  @Post()
  @ApiOperation({ operationId: "aboutSectionCreate", description: "Create a new about section" })
  @JsonApiResponse(AboutSectionDto)
  @ExceptionResponse(UnauthorizedException, { description: "About section creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Payload malformed." })
  async create(@Body() payload: CreateAboutSectionBody) {
    await this.policyService.authorize("create", AboutSection);

    const section = await this.aboutSectionsService.store(payload.data.attributes);
    return await this.aboutSectionsService.addDto(buildJsonApi<AboutSectionDto>(AboutSectionDto), section);
  }

  // Using PUT instead of PATCH because if a link is left out of the attributes, it is removed from
  // the about section links. PUT is the correct method for this mechanic.
  @Put(":uuid")
  @ApiOperation({ operationId: "aboutSectionUpdate", description: "Update an about section" })
  @JsonApiResponse(AboutSectionDto)
  @ExceptionResponse(UnauthorizedException, { description: "About section update not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Payload malformed." })
  @ExceptionResponse(NotFoundException, { description: "About section not found." })
  async update(@Param("uuid") uuid: string, @Body() payload: UpdateAboutSectionBody) {
    if (uuid !== payload.data.id) {
      throw new BadRequestException("About section id in path and payload do not match");
    }

    const section = await AboutSection.findOne({ where: { uuid } });
    if (section == null) throw new NotFoundException();
    await this.policyService.authorize("update", section);
    await this.aboutSectionsService.store(payload.data.attributes, section);
    return await this.aboutSectionsService.addDto(buildJsonApi<AboutSectionDto>(AboutSectionDto), section);
  }

  @Delete(":uuid")
  @ApiOperation({ operationId: "aboutSectionDelete", summary: "Soft delete about section by UUID" })
  @JsonApiDeletedResponse(getDtoType(AboutSectionDto), { description: "Associated about section was deleted" })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource is unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "About section not found." })
  async delete(@Param("uuid") uuid: string) {
    const aboutSection = await AboutSection.findOne({ where: { uuid } });
    if (aboutSection == null) throw new NotFoundException();
    await this.policyService.authorize("delete", aboutSection);

    await aboutSection.destroy();
    return buildDeletedResponse(getDtoType(AboutSectionDto), uuid);
  }
}
