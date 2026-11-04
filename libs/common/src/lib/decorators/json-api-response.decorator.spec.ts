import { DelayedJobDto } from "../dto/delayed-job.dto";
import { JsonApiDeletedResponse } from "./json-api-response.decorator";

// Metadata keys from @nestjs/swagger, whose constants are not exported from the package root.
const API_RESPONSE = "swagger/apiResponse";
const API_EXTRA_MODELS = "swagger/apiExtraModels";

type ResponseSchemas = Record<string, { schema: { oneOf?: object[]; properties?: object } }>;

const getResponseMetadata = (method: () => unknown) => ({
  responses: Reflect.getMetadata(API_RESPONSE, method) as ResponseSchemas,
  extraModels: (Reflect.getMetadata(API_EXTRA_MODELS, method) ?? []) as object[]
});

describe("JsonApiDeletedResponse", () => {
  it("documents only the deleted response by default", () => {
    class TestController {
      @JsonApiDeletedResponse("things")
      deleteThings() {
        return null;
      }
    }

    const { responses, extraModels } = getResponseMetadata(TestController.prototype.deleteThings);

    expect(responses["200"].schema.properties).toHaveProperty("meta");
    expect(responses["200"].schema.oneOf).toBeUndefined();
    expect(extraModels).toEqual([]);
  });

  it("documents the alternatives an endpoint may return instead", () => {
    class TestController {
      @JsonApiDeletedResponse("things", {}, [DelayedJobDto])
      deleteThings() {
        return null;
      }
    }

    const { responses, extraModels } = getResponseMetadata(TestController.prototype.deleteThings);

    const { oneOf } = responses["200"].schema;
    expect(oneOf).toHaveLength(2);
    expect(oneOf?.[0]).toHaveProperty("properties.meta");
    expect(oneOf?.[1]).toHaveProperty("properties.data");
    expect(extraModels).toContain(DelayedJobDto);
  });
});
