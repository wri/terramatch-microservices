import { Injectable } from "@nestjs/common";

@Injectable()
export class TotalSectionHeaderService {
  constructor() {}

  async getTotalSectionHeader() {
    return {
      total: 100,
      totalProjects: 100,
      totalUsers: 100
    };
  }
}
