import { Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { UserPolicy } from "./user.policy";
import {
  Application,
  AuditStatus,
  Demographic,
  Disturbance,
  DisturbanceReport,
  FinancialIndicator,
  FinancialReport,
  Form,
  FormQuestionOption,
  FormSubmission,
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
  User
} from "@terramatch-microservices/database/entities";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
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
import { DemographicPolicy } from "./demographic.policy";
import { AuditStatusPolicy } from "./audit-status.policy";
import { FinancialIndicatorPolicy } from "./financial-indicator.policy";
import { FinancialReportPolicy } from "./financial-report.policy";
import { FormPolicy } from "./form.policy";
import { FormQuestionOptionPolicy } from "./form-question-option.policy";
import { FundingProgrammePolicy } from "./funding-programme.policy";
import { ImpactStoryPolicy } from "./impact-story.policy";
import { DisturbancePolicy } from "./disturbance.policy";
import { OrganisationPolicy } from "./organisation.policy";
import { DisturbanceReportPolicy } from "./disturbance-report.policy";
import { SrpReportPolicy } from "./srp-report.policy";
import { authenticatedUserId } from "../guards/auth.guard";
import { FormSubmissionPolicy } from "./form-submission.policy";
import { ApplicationPolicy } from "./application.policy";
import { MediaPolicy } from "./media.policy";

type EntityClass = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): Model;
  name?: string;
};

type PolicyClass = {
  new (userId: number, permissions: string[], builder: AbilityBuilder<BuilderType>): UserPermissionsPolicy;
};

const POLICIES: [EntityClass, PolicyClass][] = [
  [Application, ApplicationPolicy],
  [AuditStatus, AuditStatusPolicy],
  [Demographic, DemographicPolicy],
  [Disturbance, DisturbancePolicy],
  [ImpactStory, ImpactStoryPolicy],
  [FinancialIndicator, FinancialIndicatorPolicy],
  [FinancialReport, FinancialReportPolicy],
  [DisturbanceReport, DisturbanceReportPolicy],
  [SrpReport, SrpReportPolicy],
  [Form, FormPolicy],
  [FormSubmission, FormSubmissionPolicy],
  [FormQuestionOption, FormQuestionOptionPolicy],
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
  [User, UserPolicy]
];

/**
 * A service for finding the correct policy given an entity subject, building rules for the currently
 * authenticated user and checking the given action and subject against those rules.
 *
 * In the future, this will need some additional methods for acting on an array of subjects, and
 * potentially subjects of different types.
 *
 * @throws UnauthorizedException if there is no authenticated user id, there's no policy defined for
 *   the subject, or if the requested action is not allowed against the subject for this user.
 */
@Injectable({ scope: Scope.REQUEST })
export class PolicyService {
  private readonly log = new TMLogger(PolicyService.name);
  private permissions?: string[];

  get userId() {
    return authenticatedUserId();
  }

  async getPermissions() {
    if (this.permissions != null) return this.permissions;

    if (this.userId == null) throw new UnauthorizedException();
    return (this.permissions = await Permission.getUserPermissionNames(this.userId));
  }

  async authorize(action: string, subject: Model | EntityClass | Model[]) {
    if (this.userId == null) throw new UnauthorizedException();

    const subjects = isArray(subject) ? subject : [subject];
    const [, PolicyClass] =
      POLICIES.find(([entityClass]) => subjects[0] instanceof entityClass || subjects[0] === entityClass) ?? [];
    if (PolicyClass == null) {
      this.log.error(`No policy found for subject type [${subject.constructor.name}]`);
      throw new UnauthorizedException();
    }

    const builder = new AbilityBuilder(createMongoAbility);
    await new PolicyClass(this.userId, await this.getPermissions(), builder).addRules();

    const ability = builder.build();
    const hasUnauthorized = subjects.find(subject => ability.cannot(action, subject)) != null;
    if (hasUnauthorized) throw new UnauthorizedException();
  }

  async hasAccess(action: string, subject: Model | EntityClass | Model[]): Promise<boolean> {
    try {
      await this.authorize(action, subject);
      return true;
    } catch {
      return false;
    }
  }
}
