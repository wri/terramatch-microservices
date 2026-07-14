import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { AboutSectionDto } from "./dto/about-section.dto";
import { AboutSectionsService } from "./about-sections.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { AboutSection } from "@terramatch-microservices/database/entities";

@Controller("aboutSections/v3/aboutSections")
export class AboutSectionsController {
  constructor(private readonly aboutSectionsService: AboutSectionsService) {}

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
