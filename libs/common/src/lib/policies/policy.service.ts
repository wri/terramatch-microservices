import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UserPolicy } from "./user.policy";
import {
  AnrPlotGeometry,
  Application,
  AuditStatus,
  Disturbance,
  DisturbanceReport,
  FinancialIndicator,
  FinancialReport,
  Form,
  FormQuestionOption,
  FormSubmission,
  Framework,
  FundingProgramme,
  ImpactStory,
  Media,
  Nursery,
  NurseryReport,
  Organisation,
  Permission,
  Project,
  ProjectPitch,
  ProjectPolygon,
  ProjectReport,
  Site,
  SitePolygon,
  SiteReport,
  SrpReport,
  Task,
  Tracking,
  User
} from "@terramatch-microservices/database/entities";
import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability";
import { Model } from "sequelize-typescript";
import { SitePolygonPolicy } from "./site-polygon.policy";
import { ProjectPolicy } from "./project.policy";
import { ProjectPolygonPolicy } from "./project-polygon.policy";
import { isArray } from "lodash";
import { BuilderType, UserPermissionsPolicy } from "./user-permissions.policy";
import { ProjectReportPolicy } from "./project-report.policy";
import { SiteReportPolicy } from "./site-report.policy";
import { SitePolicy } from "./site.policy";
import { NurseryReportPolicy } from "./nursery-report.policy";
import { NurseryPolicy } from "./nursery.policy";
import { TMLogger } from "../util/tm-logger";
import { ProjectPitchPolicy } from "./project-pitch.policy";
import { TaskPolicy } from "./task.policy";
import { TrackingPolicy } from "./tracking.policy";
import { AuditStatusPolicy } from "./audit-status.policy";
import { FinancialIndicatorPolicy } from "./financial-indicator.policy";
import { FinancialReportPolicy } from "./financial-report.policy";
import { FormPolicy } from "./form.policy";
import { FormQuestionOptionPolicy } from "./form-question-option.policy";
import { FrameworkPolicy } from "./framework.policy";
import { FundingProgrammePolicy } from "./funding-programme.policy";
import { ImpactStoryPolicy } from "./impact-story.policy";
import { AnrPlotGeometryPolicy } from "./anr-plot-geometry.policy";
import { DisturbancePolicy } from "./disturbance.policy";
import { OrganisationPolicy } from "./organisation.policy";
import { DisturbanceReportPolicy } from "./disturbance-report.policy";
import { SrpReportPolicy } from "./srp-report.policy";
import { authenticatedUserId } from "../guards/auth.guard";
import { FormSubmissionPolicy } from "./form-submission.policy";
import { ApplicationPolicy } from "./application.policy";
import { MediaPolicy } from "./media.policy";
import { getRequestCached } from "../util/request";

type EntityClass = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): Model;
  name?: string;
};

type PolicyClass = {
  new (userId: number, permissions: string[], builder: AbilityBuilder<BuilderType>): UserPermissionsPolicy;
};

const POLICIES: [EntityClass, PolicyClass][] = [
  [AnrPlotGeometry, AnrPlotGeometryPolicy],
  [Application, ApplicationPolicy],
  [AuditStatus, AuditStatusPolicy],
  [Disturbance, DisturbancePolicy],
  [ImpactStory, ImpactStoryPolicy],
  [FinancialIndicator, FinancialIndicatorPolicy],
  [FinancialReport, FinancialReportPolicy],
  [DisturbanceReport, DisturbanceReportPolicy],
  [SrpReport, SrpReportPolicy],
  [Form, FormPolicy],
  [FormSubmission, FormSubmissionPolicy],
  [FormQuestionOption, FormQuestionOptionPolicy],
  [Framework, FrameworkPolicy],
  [FundingProgramme, FundingProgrammePolicy],
  [Media, MediaPolicy],
  [Nursery, NurseryPolicy],
  [NurseryReport, NurseryReportPolicy],
  [Organisation, OrganisationPolicy],
  [Project, ProjectPolicy],
  [ProjectPitch, ProjectPitchPolicy],
  [ProjectPolygon, ProjectPolygonPolicy],
  [ProjectReport, ProjectReportPolicy],
  [Site, SitePolicy],
  [SitePolygon, SitePolygonPolicy],
  [SiteReport, SiteReportPolicy],
  [Task, TaskPolicy],
  [Tracking, TrackingPolicy],
  [User, UserPolicy]
];

class PolicyBuilder {
  private builder: AbilityBuilder<MongoAbility>;
  private loadedPolicyClasses: PolicyClass[] = [];
  private ability: MongoAbility | undefined;

  constructor(private readonly userId: number, private readonly permissions: string[]) {
    this.builder = new AbilityBuilder(createMongoAbility);
  }

  async getAbilityWith(policyClass: PolicyClass) {
    if (this.ability != null && this.loadedPolicyClasses.includes(policyClass)) return this.ability;

    await new policyClass(this.userId, this.permissions, this.builder).addRules();
    this.loadedPolicyClasses.push(policyClass);
    return (this.ability = this.builder.build());
  }
}

/**
 * A service for finding the correct policy given an entity subject, building rules for the currently
 * authenticated user and checking the given action and subject against those rules.
 *
 * @throws UnauthorizedException if there is no authenticated user id, there's no policy defined for
 *   the subject, or if the requested action is not allowed against the subject for this user.
 */
@Injectable()
export class PolicyService {
  private readonly log = new TMLogger(PolicyService.name);

  get userId() {
    return authenticatedUserId();
  }

  async getPermissions() {
    return await getRequestCached("permissions", async () => {
      if (this.userId == null) throw new UnauthorizedException();
      return await Permission.getUserPermissionNames(this.userId);
    });
  }

  async hasAccess(action: string, subject: Model | EntityClass | Model[]) {
    if (this.userId == null) return false;

    const subjects = isArray(subject) ? subject : [subject];
    const [, PolicyClass] =
      POLICIES.find(([entityClass]) => subjects[0] instanceof entityClass || subjects[0] === entityClass) ?? [];
    if (PolicyClass == null) {
      this.log.error(`No policy found for subject type [${subject.constructor.name}]`);
      return false;
    }

    const ability = await this.getAbilityWith(PolicyClass);
    return subjects.find(subject => ability.cannot(action, subject)) == null;
  }

  async authorize(action: string, subject: Model | EntityClass | Model[]) {
    if (!(await this.hasAccess(action, subject))) throw new UnauthorizedException();
  }

  private async getAbilityWith(policyClass: PolicyClass) {
    const builder = await getRequestCached(
      "policyBuilder",
      async () => new PolicyBuilder(this.userId as number, await this.getPermissions())
    );
    return await builder.getAbilityWith(policyClass);
  }
}
