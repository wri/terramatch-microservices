import { Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import { Tracking, TrackingEntry, Project, ProjectReport } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";

@Injectable()
export class TotalJobsCreatedService {
  async getTotals(query: DashboardQueryDto) {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projectIds: number[] = await projectsBuilder.pluckIds();

    const projectReports = await ProjectReport.findAll({
      attributes: ["id"],
      where: { projectId: { [Op.in]: projectIds }, status: "approved" }
    });

    // demographics for jobs
    const jobDemographics = await Tracking.findAll({
      attributes: ["id", "collection"],
      where: {
        trackableType: ProjectReport.LARAVEL_TYPE,
        trackableId: { [Op.in]: projectReports.map(r => r.id) },
        hidden: false,
        domain: "demographics",
        type: "jobs"
      },
      include: [{ association: "entries" }]
    });

    // demographics for volunteers
    const volunteerDemographics = await Tracking.findAll({
      attributes: ["id", "collection"],
      where: {
        trackableId: { [Op.in]: projectReports.map(r => r.id) },
        trackableType: ProjectReport.LARAVEL_TYPE,
        hidden: false,
        domain: "demographics",
        type: "volunteers"
      },
      include: [{ association: "entries" }]
    });

    const allJobs = this.getEntries(jobDemographics);
    const ftJobs = this.getEntries(this.getCollection(jobDemographics, "full-time"));
    const ptJobs = this.getEntries(this.getCollection(jobDemographics, "part-time"));

    const allVolunteers = this.getEntries(volunteerDemographics);

    const knownGenderSubtypes = ["male", "female", "non-binary"];
    const knownAgeSubtypes = ["youth", "non-youth"];

    return {
      totalJobsCreated: this.getSum(this.getType(allJobs, "gender")),
      totalFt: this.getSum(this.getType(ftJobs, "gender")),
      totalPt: this.getSum(this.getType(ptJobs, "gender")),

      totalMen: this.getSum(this.getType(allJobs, "gender", "male")),
      totalPtMen: this.getSum(this.getType(ptJobs, "gender", "male")),
      totalFtMen: this.getSum(this.getType(ftJobs, "gender", "male")),

      totalWomen: this.getSum(this.getType(allJobs, "gender", "female")),
      totalPtWomen: this.getSum(this.getType(ptJobs, "gender", "female")),
      totalFtWomen: this.getSum(this.getType(ftJobs, "gender", "female")),

      totalNonBinary: this.getSum(this.getType(allJobs, "gender", "non-binary")),
      totalPtNonBinary: this.getSum(this.getType(ptJobs, "gender", "non-binary")),
      totalFtNonBinary: this.getSum(this.getType(ftJobs, "gender", "non-binary")),

      totalOthersGender: this.getSum(this.getOthers(allJobs, "gender", knownGenderSubtypes)),
      totalPtOthersGender: this.getSum(this.getOthers(ptJobs, "gender", knownGenderSubtypes)),
      totalFtOthersGender: this.getSum(this.getOthers(ftJobs, "gender", knownGenderSubtypes)),

      totalYouth: this.getSum(this.getType(allJobs, "age", "youth")),
      totalPtYouth: this.getSum(this.getType(ptJobs, "age", "youth")),
      totalFtYouth: this.getSum(this.getType(ftJobs, "age", "youth")),

      totalNonYouth: this.getSum(this.getType(allJobs, "age", "non-youth")),
      totalPtNonYouth: this.getSum(this.getType(ptJobs, "age", "non-youth")),
      totalFtNonYouth: this.getSum(this.getType(ftJobs, "age", "non-youth")),

      totalOthersAge: this.getSum(this.getOthers(allJobs, "age", knownAgeSubtypes)),
      totalPtOthersAge: this.getSum(this.getOthers(ptJobs, "age", knownAgeSubtypes)),
      totalFtOthersAge: this.getSum(this.getOthers(ftJobs, "age", knownAgeSubtypes)),

      totalVolunteers: this.getSum(this.getType(allVolunteers, "gender")),
      volunteerMen: this.getSum(this.getType(allVolunteers, "gender", "male")),
      volunteerWomen: this.getSum(this.getType(allVolunteers, "gender", "female")),
      volunteerNonBinary: this.getSum(this.getType(allVolunteers, "gender", "non-binary")),
      volunteerOthers: this.getSum(this.getOthers(allVolunteers, "gender", knownGenderSubtypes)),
      volunteerYouth: this.getSum(this.getType(allVolunteers, "age", "youth")),
      volunteerNonYouth: this.getSum(this.getType(allVolunteers, "age", "non-youth")),
      volunteerAgeOthers: this.getSum(this.getOthers(allVolunteers, "age", knownAgeSubtypes))
    };
  }

  private getEntries(demographics: Tracking[]) {
    return demographics.map(d => d.entries).flat();
  }

  private getCollection(demographics: Tracking[], collection: string) {
    return demographics.filter(d => d.collection === collection);
  }

  private getType(entries: (TrackingEntry | null)[], type: string, subType?: string) {
    return entries.filter(d => d?.type === type && (subType === undefined || d?.subtype === subType));
  }

  private getOthers(entries: (TrackingEntry | null)[], type: string, knownSubtypes: string[]) {
    return entries.filter(d => d?.type === type && d?.subtype !== null && !knownSubtypes.includes(d.subtype));
  }

  private getSum(entries: (TrackingEntry | null)[]) {
    return entries.reduce((sum, entry) => sum + (entry?.amount ?? 0), 0);
  }
}
