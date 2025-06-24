import { Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import { Demographic, DemographicEntry, ProjectReport } from "@terramatch-microservices/database/entities";
import { TotalJobsCreatedQueryDto } from "./dto/total-jobs-created-query.dto";

@Injectable()
export class TotalJobsCreatedService {
  async getTotals(query: TotalJobsCreatedQueryDto): Promise<any> {
    const records = await ProjectReport.findAll({
      attributes: ["id"],
      where: { uuid: { [Op.in]: query.projectUuid } }
    });

    const demographics = await Demographic.findAll({
      attributes: ["id", "collection"],
      where: {
        demographicalId: { [Op.in]: records.map(record => record.id) },
        hidden: false,
        type: "jobs",
        demographicalType: ProjectReport.LARAVEL_TYPE
      },
      include: [{ association: "entries" }]
    });

    const all = this.getEntries(demographics);
    const ft = this.getEntries(this.getCollection(demographics, "full-time"));
    const pt = this.getEntries(this.getCollection(demographics, "part-time"));

    console.log(all, ft, pt);

    return {
      totalJobsCreated: this.getSum(this.getType(all, "gender")),
      totalFt: this.getSum(this.getType(ft, "gender")),
      totalPt: this.getSum(this.getType(pt, "gender")),

      totalMen: this.getSum(this.getType(all, "gender", "male")),
      totalPtMen: this.getSum(this.getType(pt, "gender", "male")),
      totalFtMen: this.getSum(this.getType(ft, "gender", "male")),

      totalWomen: this.getSum(this.getType(all, "gender", "female")),
      totalPtWomen: this.getSum(this.getType(pt, "gender", "female")),
      totalFtWomen: this.getSum(this.getType(ft, "gender", "female")),

      totalYouth: this.getSum(this.getType(all, "age", "youth")),
      totalPtYouth: this.getSum(this.getType(pt, "age", "youth")),
      totalFtYouth: this.getSum(this.getType(ft, "age", "youth")),

      totalNonYouth: this.getSum(this.getType(all, "age", "non-youth")),
      totalPtNonYouth: this.getSum(this.getType(pt, "age", "non-youth")),
      totalFtNonYouth: this.getSum(this.getType(ft, "age", "non-youth"))
    };
  }

  private getEntries(demographics: Demographic[]) {
    return demographics.map(d => d.entries).flat();
  }

  private getCollection(demographics: Demographic[], collection: string) {
    return demographics.filter(d => d.type === collection);
  }

  private getType(entries: (DemographicEntry | null)[], type: string, subType?: string) {
    return entries.filter(d => d?.type === type && (subType === undefined || d?.subtype === subType));
  }

  private getSum(entries: (DemographicEntry | null)[]) {
    return entries.reduce((sum, entry) => sum + (entry?.amount ?? 0), 0);
  }
}
