import { Injectable } from "@nestjs/common";
import { ProjectPitch } from "@terramatch-microservices/database/entities";

@Injectable()
export class ProjectPitchService {
  async getProjectPitch(uuid: string): Promise<ProjectPitch> {
    return await ProjectPitch.findOne({ where: { uuid } });
  }

  async getProjectPitches(): Promise<ProjectPitch[]> {
    return await ProjectPitch.findAll({ limit: 10 });
  }
}
