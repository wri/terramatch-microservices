import { Injectable } from "@nestjs/common";
import { ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import * as console from "node:console";

@Injectable()
export class ProjectPitchService {
  async getProjectPitch(uuid: string): Promise<ProjectPitch> {
    return await ProjectPitch.findOne({ where: { uuid } });
  }

  async getProjectPitches(userId: string): Promise<ProjectPitch[]> {
    const user = await User.findOne({
      include: ["roles", "organisation", "frameworks"],
      where: { id: userId }
    });
    await user.loadOrganisation();
    console.log("user organization", user.organisations);
    return await ProjectPitch.findAll({
      where: {
        /*organisationId: {
           [Op.in]: user.organisations.map(org => org.id)
        },*/
        organisationId: user.organisation.id
      },
      limit: 10
    });
  }

  async getAdminProjectPitches(): Promise<ProjectPitch[]> {
    return await ProjectPitch.findAll({ limit: 10 });
  }
}
