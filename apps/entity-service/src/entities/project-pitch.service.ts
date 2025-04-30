import { Injectable } from "@nestjs/common";
import { ProjectPitchDto } from "./dto/project-pitch.dto";

@Injectable()
export class ProjectPitchService {
  getProjectPitch(uuid: string): Promise<ProjectPitchDto> {
    // Mock implementation, replace with actual database call
    return Promise.resolve(new ProjectPitchDto(null, null));
  }
}
