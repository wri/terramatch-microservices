import { Injectable } from "@nestjs/common";
import { ProjectUser, User } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

@Injectable()
export class UserAssociationService {
  async getUserAssociation(projectId: number) {
    const users = await User.findAll({
      where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
      attributes: ["id", "uuid", "emailAddress"]
    });

    return users;
  }
}
