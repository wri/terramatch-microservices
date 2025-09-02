import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FormDto } from "./dto/form.dto";
import { FormQuestionDto } from "./dto/form-question.dto";
import { FormSectionDto } from "./dto/form-section.dto";

@Controller("forms/v3/forms")
export class FormsController {
  @Get(":uuid")
  @ApiOperation({
    operationId: "formGet",
    description: "Get a form by uuid. Includes all sections and questions within the form."
  })
  @ApiParam({ name: "uuid", type: String, description: "Form uuid" })
  @JsonApiResponse({ data: FormDto, included: [FormSectionDto, FormQuestionDto] })
  async formGet() {
    // TODO: form section response only directly relates to questions with no parent id
    // TODO: relate to question children UUIDs
  }
}
