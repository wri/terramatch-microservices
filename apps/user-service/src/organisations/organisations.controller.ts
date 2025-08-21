import { BadRequestException, Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { OrganisationCreateBody } from "./dto/organisation-create.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { OrganisationDto, UserDto } from "@terramatch-microservices/common/dto";
import { USER_ORG_RELATIONSHIP } from "../users/users.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { OrganisationCreationService } from "./organisation-creation.service";
import { ApiOperation } from "@nestjs/swagger";

@Controller("organisations/v3/organisations")
export class OrganisationsController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly organisationCreationService: OrganisationCreationService
  ) {}

  @Post()
  @ApiOperation({
    operationId: "organisationCreation",
    description: "Create a new organisation, and the first user for it."
  })
  @JsonApiResponse({
    data: OrganisationDto,
    included: [{ type: UserDto, relationships: [USER_ORG_RELATIONSHIP] }]
  })
  @ExceptionResponse(UnauthorizedException, { description: "Organisation creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "One or more attributes are invalid or missing." })
  async create(@Body() payload: OrganisationCreateBody) {
    const { user, organisation } = await this.organisationCreationService.createNewOrganisation(
      payload.data.attributes
    );
  }
}
