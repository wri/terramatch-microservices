import { Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import { Demographic, DemographicEntry, ProjectReport } from "@terramatch-microservices/database/entities";
import { JobsCreatedQueryDto } from "./dto/jobs-created-query.dto";

@Injectable()
export class JobsCreatedService {
  async getTotals(query: JobsCreatedQueryDto): Promise<any> {
    const records = await ProjectReport.findAll({
      attributes: ["id"],
      where: { uuid: { [Op.in]: query.projectUuid } }
    });

    const demographics = await Demographic.findAll({
      attributes: ["id", "entries"],
      where: {
        demographicalId: { [Op.in]: records.map(record => record.id) },
        hidden: false,
        type: "jobs",
        demographicalType: ProjectReport.LARAVEL_TYPE
      }
    });

    const all = this.getEntries(demographics);
    const ft = this.getEntries(this.getCollection(demographics, "full-time"));
    const pt = this.getEntries(this.getCollection(demographics, "part-time"));

    return {
      totalJobsCreated: 0,
      totalFt: 0,
      totalFtMen: 0,
      totalFtNonYouth: 0,
      totalFtWomen: 0,
      totalFtYouth: 0,
      totalMen: 0,
      totalNonYouth: 0,
      totalPt: 0,
      totalPtMen: 0,
      totalPtNonYouth: 0,
      totalPtWomen: 0,
      totalPtYouth: 0,
      totalWomen: 0,
      totalYouth: 0
    };
  }

  getEntries(demographics: Demographic[]) {
    return demographics.map(d => d.entries).flat();
  }

  getCollection(demographics: Demographic[], collection: string) {
    return demographics.filter(d => d.type === collection);
  }

  getType(entries: DemographicEntry[], type: string, subType: string) {
    return entries.filter(d => d.type === type && d.subtype === subType);
  }

  getSum(entries: DemographicEntry[]) {
    return entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  }
}
