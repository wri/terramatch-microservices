import { Injectable } from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities";

export interface ProjectAuthResult {
  allowed: boolean;
}

@Injectable()
export class ProjectAuthService {
  async checkUserProjectAccess(projectUuid: string, user: User | null): Promise<ProjectAuthResult> {
    return { allowed: user !== null };
  }
}
