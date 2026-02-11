import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { UserAssociationService } from "./user-association.service";
import { Project } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { UserAssociationDto } from "./dto/user-association.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("userAssociations/v3/projects")
export class UserAssociationController {
  constructor(private readonly userAssociationService: UserAssociationService) {}

  @Get(":uuid")
  @ApiOperation({
    operationId: "getUserAssociation",
    summary: "Get the users associated with a project"
  })
  @JsonApiResponse([{ data: UserAssociationDto, pagination: "number" }])
  @ExceptionResponse(NotFoundException, { description: "Project not found" })
  async getUserAssociation(@Param("uuid") uuid: string) {
    const project = await Project.findOne({
      where: { uuid },
      attributes: ["id"]
    });
    if (project == null) {
      throw new NotFoundException("Project not found");
    }
    const users = await this.userAssociationService.getUserAssociation(project.id);
    const document = buildJsonApi(UserAssociationDto, { pagination: "number" });
    const indexIds = users.map(user => user.uuid as string);
    document.addIndex({
      resource: "userAssociations",
      requestPath: `/userAssociations/v3/projects/${uuid}/userAssociations`,
      total: users.length,
      pageNumber: 1,
      ids: indexIds
    });
    for (const user of users) {
      document.addData(user.uuid as string, new UserAssociationDto(user));
    }
    return document;
  }
}
