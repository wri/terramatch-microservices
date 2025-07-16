import { Injectable } from "@nestjs/common";
import { User, Project } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";

export interface DashboardAuthResult {
  allowed: boolean;
}

@Injectable()
export class DashboardAuthService {
  constructor(private readonly policyService: PolicyService) {}

  async checkUserProjectAccess(projectUuid: string, userId: number | null): Promise<DashboardAuthResult> {
    if (userId === null) {
      return { allowed: false };
    }

    try {
      const project = await Project.findOne({ where: { uuid: projectUuid } });
      if (project === null) {
        return { allowed: false };
      }

      await this.policyService.authorize("read", project);
      return { allowed: true };
    } catch {
      return { allowed: false };
    }
  }
}
