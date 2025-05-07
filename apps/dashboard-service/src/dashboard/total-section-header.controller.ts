import { Get } from "@nestjs/common";

import { Controller } from "@nestjs/common";
import { TotalSectionHeaderService } from "./dto/total-section-header.service";
import { ApiOperation } from "@nestjs/swagger";

@Controller("dashboard/total-section-header")
export class TotalSectionHeaderController {
  constructor(private readonly totalSectionHeaderService: TotalSectionHeaderService) {}

  @Get()
  @ApiOperation({ summary: "Get total section header" })
  async getTotalSectionHeader() {
    return this.totalSectionHeaderService.getTotalSectionHeader();
  }
}
