import { DtoOptions } from "../decorators/json-api-dto.decorator";
import { Equals, IsIn, IsNotEmpty, IsNumberString, IsString, IsUUID, ValidateNested } from "class-validator";
import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { DiscriminatorDescriptor, Type } from "class-transformer";
import { InternalServerErrorException } from "@nestjs/common";
import { DECORATORS } from "@nestjs/swagger/dist/constants";

function UuidDataDto<T>(type: string, AttributesDto: new () => T) {
  class DataDto {
    @Equals(type)
    @ApiProperty({ enum: [type] })
    type: string;

    @IsUUID()
    @ApiProperty({ format: "uuid" })
    id: string;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => AttributesDto)
    @ApiProperty({ type: () => AttributesDto })
    attributes: T;
  }
  return DataDto;
}

function NumberDataDto<T>(type: string, AttributesDto: new () => T) {
  class DataDto {
    @Equals(type)
    @ApiProperty({ enum: [type] })
    type: string;

    @IsNumberString({ no_symbols: true })
    @ApiProperty({ pattern: "^\\d{5}$" })
    id: string;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => AttributesDto)
    @ApiProperty({ type: () => AttributesDto })
    attributes: T;
  }
  return DataDto;
}

function StringDataDto<T>(type: string, AttributesDto: new () => T) {
  class DataDto {
    @Equals(type)
    @ApiProperty({ enum: [type] })
    type: string;

    @IsString()
    @ApiProperty()
    id: string;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => AttributesDto)
    @ApiProperty({ type: () => AttributesDto })
    attributes: T;
  }
  return DataDto;
}

export function FormDataDataDto<T>(type: string, AttributesDto: new () => T) {
  class DataDto {
    @Equals(type)
    @ApiProperty({ enum: [type] })
    type: string;

    @Type(() => AttributesDto)
    @ApiProperty({ type: () => AttributesDto })
    attributes: T;
  }
  return DataDto;
}

export function CreateDataDto<T>(type: string, AttributesDto: new () => T) {
  class DataDto {
    @Equals(type)
    @ApiProperty({ enum: [type] })
    type: string;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => AttributesDto)
    @ApiProperty({ type: () => AttributesDto })
    attributes: T;
  }
  return DataDto;
}

export function JsonApiDataDto<T>(options: DtoOptions, AttributesDto: new () => T) {
  // It's tedious to have these three specified separately, but if we specify these differently as
  // an intermediate base class and then a subclass with the correct id annotations, it mixes up
  // the order of the properties in the resulting Swagger docs.
  if (options.id === "uuid" || options.id == null) {
    return UuidDataDto(options.type, AttributesDto);
  }

  if (options.id === "number") {
    return NumberDataDto(options.type, AttributesDto);
  }

  if (options.id === "string") {
    return StringDataDto(options.type, AttributesDto);
  }

  throw new InternalServerErrorException(`Options id not recognized [${options.id}]`);
}

export function ApiFormDataBodyDto<T>(DataDto: new () => T) {
  class BodyDto extends FormData {
    @IsNotEmpty()
    @Type(() => DataDto)
    @ApiProperty({ type: () => DataDto })
    data: T;
  }

  return BodyDto;
}

export function JsonApiBodyDto<T>(DataDto: new () => T) {
  class BodyDto {
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => DataDto)
    @ApiProperty({ type: () => DataDto })
    data: T;
  }

  return BodyDto;
}

/**
 * Creates a DTO object for JSON:API update that can accept multiple different types of payload
 * attributes, distinguished by the `type` param. See `entity-update.dto.ts` for example usage.
 *
 * Note: the DTOs passed in must be a const array in order to maintain the union type of all possible
 * values in T, which is used for the typing of the `data` member of the main body DTO.
 */
export function JsonApiMultiBodyDto<T extends new () => unknown>(dtos: readonly T[]) {
  const subTypes: DiscriminatorDescriptor["subTypes"] = [];
  for (const dto of dtos) {
    const apiModelProperties = Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, dto.prototype, "type");
    if (apiModelProperties == null || apiModelProperties?.enum == null || apiModelProperties?.enum.length !== 1) {
      throw new InternalServerErrorException(
        "Multi body DTO must have a 'type' property defined with a single enum value"
      );
    }

    subTypes.push({ name: apiModelProperties.enum[0], value: dto });
  }

  class GenericData {
    @IsIn(subTypes.map(({ name }) => name))
    type: string;
  }

  @ApiExtraModels(...dtos)
  class MultiBodyDto {
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => GenericData, {
      discriminator: {
        property: "type",
        subTypes
      },
      keepDiscriminatorProperty: true
    })
    @ApiProperty({
      oneOf: dtos.map(dto => ({
        $ref: getSchemaPath(dto)
      }))
    })
    data: InstanceType<T>;
  }

  return MultiBodyDto;
}
