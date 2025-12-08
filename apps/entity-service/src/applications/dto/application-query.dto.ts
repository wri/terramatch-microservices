import { ApiProperty } from "@nestjs/swagger";

const APPLICATION_SIDELOADS = ["currentSubmission", "fundingProgramme"] as const;
type ApplicationSideload = (typeof APPLICATION_SIDELOADS)[number];
export class ApplicationGetQueryDto {
  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    enum: APPLICATION_SIDELOADS,
    description: "sideloads to include"
  })
  sideloads?: ApplicationSideload[];
}
