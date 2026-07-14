import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { AboutSectionDto } from "./dto/about-section.dto";
import { AboutSectionsService } from "./about-sections.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { AboutSection } from "@terramatch-microservices/database/entities";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";

@Controller("aboutSections/v3/aboutSections")
export class AboutSectionsController {
  constructor(private readonly aboutSectionsService: AboutSectionsService) {}

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
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async get(@Param() { uuid }: SingleResourceDto) {
    const aboutSection = await AboutSection.findOne({ where: { uuid } });
    if (aboutSection == null) throw new NotFoundException();

    return this.aboutSectionsService.addDto(buildJsonApi<AboutSectionDto>(AboutSectionDto), aboutSection);
  }
}
