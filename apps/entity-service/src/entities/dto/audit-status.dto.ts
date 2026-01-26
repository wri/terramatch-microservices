import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { Audit } from "@terramatch-microservices/database/entities/audit.entity";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { Dictionary } from "lodash";

@JsonApiDto({ type: "auditStatuses" })
export class AuditStatusDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  status: string | null;

  @ApiProperty({ nullable: true, type: String })
  firstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  lastName: string | null;

  @ApiProperty({ nullable: true, type: String })
  comment: string | null;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  requestRemoved: boolean | null;

  @ApiProperty({ nullable: true, type: Date })
  dateCreated: Date | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  attachments: MediaDto[];

  constructor(
    id: number,
    uuid: string,
    status: string | null,
    firstName: string | null,
    lastName: string | null,
    comment: string | null,
    type: string | null,
    requestRemoved: boolean | null,
    dateCreated: Date | null,
    attachments: MediaDto[]
  ) {
    this.id = id;
    this.uuid = uuid;
    this.status = status;
    this.firstName = firstName;
    this.lastName = lastName;
    this.comment = comment;
    this.type = type;
    this.requestRemoved = requestRemoved;
    this.dateCreated = dateCreated;
    this.attachments = attachments;
  }

  static fromAuditStatus(auditStatus: AuditStatus, attachments: MediaDto[] = []): AuditStatusDto {
    // Transform status: 'started' -> 'Draft'
    let transformedStatus = auditStatus.status;
    if (transformedStatus === "started") {
      transformedStatus = "Draft";
    }

    return new AuditStatusDto(
      auditStatus.id,
      auditStatus.uuid,
      transformedStatus,
      auditStatus.firstName,
      auditStatus.lastName,
      auditStatus.comment,
      auditStatus.type,
      auditStatus.requestRemoved,
      auditStatus.dateCreated ?? auditStatus.createdAt,
      attachments
    );
  }

  static fromAudits(audit: Audit, firstName: string | null = null, lastName: string | null = null): AuditStatusDto {
    let status: string | null = null;
    let feedback: string | null = null;
    let comment: string | null = null;

    if (audit.newValues != null) {
      const newValues = audit.newValues as Dictionary<unknown>;
      status = (newValues.status as string) ?? null;
      feedback = (newValues.feedback as string) ?? null;

      if (status != null && feedback != null) {
        comment = `${status}: ${feedback}`.replace(/-/g, " ");
      } else if (status != null) {
        comment = status.replace(/-/g, " ");
      } else if (feedback != null) {
        comment = feedback.replace(/-/g, " ");
      }
    }

    const uuid = `legacy-${audit.id}`;

    return new AuditStatusDto(
      audit.id,
      uuid,
      status,
      firstName,
      lastName,
      comment,
      null,
      null,
      audit.updatedAt ?? audit.createdAt,
      []
    );
  }
}
