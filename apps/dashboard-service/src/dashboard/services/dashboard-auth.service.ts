import { Injectable } from "@nestjs/common";
import { Project } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";

@Injectable()
export class DashboardAuthService {
  constructor(private readonly policyService: PolicyService) {}

  async userHasFullProjectAccess(projectUuid: string, userId: number | null): Promise<boolean> {
    if (userId === null) {
      return false;
    }

    try {
      const project = await Project.findOne({ where: { uuid: projectUuid } });
      if (project === null) {
        return false;
      }

      await this.policyService.authorize("read", project);
      return true;
    } catch {
      return false;
    }
  }
}
