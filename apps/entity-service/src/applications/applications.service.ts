import { Injectable } from "@nestjs/common";
import { Application, FormSubmission } from "@terramatch-microservices/database/entities";
import { ApplicationHistoryEntryDto } from "./dto/application.dto";
import { AuditStatusService } from "../entities/audit-status.service";
import { AuditStatusDto } from "../entities/dto/audit-status.dto";
import { AuditStatusType } from "@terramatch-microservices/database/constants";
import { FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { DateTime } from "luxon";
import { last } from "lodash";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@Injectable()
export class ApplicationsService {
  constructor(private readonly auditStatusService: AuditStatusService) {}

  async getApplicationHistory(application: Application): Promise<ApplicationHistoryEntryDto[]> {
    const submissions = await this.findSubmissions(application.id);
    const auditStatusesBySubmissionId = await this.auditStatusService.getAuditStatusesForApplicationHistory(
      submissions
    );

    const history: ApplicationHistoryEntryDto[] = [];

    for (const submission of submissions.reverse()) {
      const auditStatusDtos = auditStatusesBySubmissionId.get(submission.id) ?? [];

      for (const dto of auditStatusDtos) {
        const entry = this.createHistoryEntryDtoFromAuditStatusDto(dto, submission.stageName);
        this.addHistoryEntry(history, entry);
      }
    }

    return history;
  }

  private addHistoryEntry(history: ApplicationHistoryEntryDto[], entry: ApplicationHistoryEntryDto) {
    const earliestEntry = last(history);
    const earliestHistoryDate = earliestEntry == null ? undefined : DateTime.fromJSDate(earliestEntry.date);

    if (earliestHistoryDate != null && DateTime.fromJSDate(entry.date) > earliestHistoryDate) {
      return;
    }

    const earliest = last(history);
    if (
      earliest != null &&
      earliest.eventType === "updated" &&
      entry.eventType === "updated" &&
      DateTime.fromJSDate(earliest.date).diff(DateTime.fromJSDate(entry.date), "hours").hours < 12
    ) {
      return;
    }

    if (
      earliest != null &&
      earliest.eventType === "updated" &&
      entry.eventType === "status" &&
      entry.status === "started" &&
      DateTime.fromJSDate(earliest.date).diff(DateTime.fromJSDate(entry.date), "hours").hours < 12
    ) {
      history[history.length - 1] = entry;
    } else {
      history.push(entry);
    }
  }

  private createHistoryEntryDtoFromAuditStatusDto(
    dto: AuditStatusDto,
    stageName: string | null
  ): ApplicationHistoryEntryDto {
    let status: FormSubmissionStatus | null = null;
    if (dto.status != null) {
      if (dto.status === "Draft") {
        status = "started";
      } else {
        status = dto.status as FormSubmissionStatus;
      }
    }

    let eventType: AuditStatusType | null = dto.type as AuditStatusType | null;
    if (eventType == null) {
      eventType = status != null ? ("status" as AuditStatusType) : ("updated" as AuditStatusType);
    }

    return populateDto(new ApplicationHistoryEntryDto(), {
      eventType,
      status,
      date: dto.dateCreated ?? new Date(),
      stageName,
      comment: dto.comment
    });
  }

  private async findSubmissions(applicationId: number) {
    return await FormSubmission.findAll({
      where: { applicationId },
      attributes: ["applicationId", "id", "uuid", "status", "createdAt", "updatedAt", "stageUuid", "userId"],
      include: [
        { association: "stage", attributes: ["name"] },
        { association: "user", attributes: ["firstName", "lastName"] }
      ]
    });
  }
}
