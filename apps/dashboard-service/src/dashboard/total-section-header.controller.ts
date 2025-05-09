import { Get, Query } from "@nestjs/common";

import { Controller } from "@nestjs/common";
import { TotalSectionHeaderService } from "./dto/total-section-header.service";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

@Controller("v3/dashboard/total-section-header")
export class TotalSectionHeaderController {
  constructor(private readonly totalSectionHeaderService: TotalSectionHeaderService) {}

  @Get()
  @ApiOperation({ summary: "Get total section header" })
  async getTotalSectionHeader(@Query() query: DashboardQueryDto) {
    return this.totalSectionHeaderService.getTotalSectionHeader(query);
  }
}
