import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { AboutSectionGetParamDto, AboutSectionGetQueryDto } from "./dto/about-section-get.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { AboutSectionDto } from "./dto/about-section.dto";
import { AboutSectionsService } from "./about-sections.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("aboutSections/v3/aboutSections")
export class AboutSectionsController {
  constructor(private readonly aboutSectionsService: AboutSectionsService) {}

  @Get(":type")
  @ApiOperation({
    operationId: "aboutSectionGet",
    description: "Get an about section by type, with optional framework"
  })
  @JsonApiResponse(AboutSectionDto)
  @ExceptionResponse(NotFoundException, { description: "About section for this type not found" })
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async get(@Param() { type }: AboutSectionGetParamDto, @Query() { framework }: AboutSectionGetQueryDto) {
    const aboutSection = await this.aboutSectionsService.findOne(type, framework);
    if (aboutSection == null) throw new NotFoundException();

    return await this.aboutSectionsService.addDto(buildJsonApi<AboutSectionDto>(AboutSectionDto), aboutSection);
  }
}
