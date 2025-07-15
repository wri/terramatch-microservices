import { Injectable } from "@nestjs/common";
import { User, Project } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { RequestContext } from "nestjs-request-context";

export interface DashboardAuthResult {
  allowed: boolean;
}

@Injectable()
export class DashboardAuthService {
  constructor(private readonly policyService: PolicyService) {}

  async checkUserProjectAccess(projectUuid: string, user: User | null): Promise<DashboardAuthResult> {
    if (user === null) {
      return { allowed: false };
    }

    try {
      RequestContext.currentContext.req.authenticatedUserId = user.id;

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
