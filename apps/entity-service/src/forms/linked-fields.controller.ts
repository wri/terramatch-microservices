import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { LinkedFieldDto } from "./dto/linked-field.dto";
import { LinkedFieldsConfiguration } from "@terramatch-microservices/common/linkedFields";
import { buildJsonApi, DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import {
  isField,
  isRelation,
  LinkedField,
  LinkedFile,
  LinkedRelation
} from "@terramatch-microservices/database/constants/linked-fields";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { isEmpty } from "lodash";
import { LinkedFieldQueryDto } from "./dto/linked-field-query.dto";
import { FormModelType } from "@terramatch-microservices/database/constants";

const fieldAdder =
  (document: DocumentBuilder, formModelType: FormModelType, nameSuffix: string) =>
  ([id, field]: [string, LinkedField | LinkedFile | LinkedRelation]) => {
    document.addData(
      id,
      populateDto<LinkedFieldDto>(new LinkedFieldDto(), {
        id,
        formModelType,
        label: field.label,
        name: `${field.label}${nameSuffix}`,
        inputType: field.inputType,
        optionListKey: isField(field) ? field.optionListKey ?? null : null,
        multiChoice: !isRelation(field) ? field.multiChoice ?? null : null,
        collection: isRelation(field) ? field.collection ?? null : null
      })
    );
  };

@Controller("forms/v3/linkedFields")
export class LinkedFieldsController {
  @Get()
  @ApiOperation({ operationId: "linkedFieldsIndex" })
  @JsonApiResponse({ data: LinkedFieldDto, hasMany: true })
  async linkedFieldsIndex(@Query() { formModelTypes }: LinkedFieldQueryDto) {
    const document = buildJsonApi(LinkedFieldDto, { forceDataArray: true });
    for (const modelType of formModelTypes ?? (Object.keys(LinkedFieldsConfiguration) as FormModelType[])) {
      const configuration = LinkedFieldsConfiguration[modelType];
      if (configuration == null) continue;

      const nameSuffix = ` (${configuration.label})`;
      const addFields = fieldAdder(document, modelType, nameSuffix);
      Object.entries(configuration.fields).forEach(addFields);
      Object.entries(configuration.fileCollections).forEach(addFields);
      Object.entries(configuration.relations).forEach(addFields);
    }

    let requestPath = "/forms/v3/linkedFields";
    if (!isEmpty(formModelTypes)) requestPath += getStableRequestQuery({ formModelTypes });
    return document.addIndex({ requestPath });
  }
}
