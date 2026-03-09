import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Put,
  Res
} from "@nestjs/common";
import { Response } from "express";
import { User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { UnauthorizedException } from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";

/**
 * Admin user actions (V2 contract: reset password, verify).
 * Routes are under admin/users so gateway can expose e.g. /api/v3/admin/users/...
 */
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly policyService: PolicyService, private readonly adminUsersService: AdminUsersService) {}

  @Put("reset-password/:uuid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "adminUsersResetPassword",
    description: "Reset a user's password by UUID (admin or self). V2-compatible."
  })
  @ApiParam({ name: "uuid", description: "User UUID" })
  @ApiResponse({
    status: 200,
    description: "Password updated",
    schema: { type: "string", example: "Password Updated" }
  })
  @ExceptionResponse(UnauthorizedException, { description: "Not authorized" })
  @ExceptionResponse(NotFoundException, { description: "No user found" })
  @ExceptionResponse(BadRequestException, { description: "Validation failed (e.g. password too weak)" })
  async resetPassword(@Param("uuid") uuid: string, @Body() dto: AdminResetPasswordDto, @Res() res: Response) {
    const user = await User.findOne({ where: { uuid }, attributes: ["id", "uuid"] });
    if (user == null) throw new NotFoundException("No user found.");

    await this.policyService.authorize("resetPassword", user);
    await this.adminUsersService.resetPasswordByUuid(uuid, dto.password);

    return res.status(HttpStatus.OK).json("Password Updated");
  }

  @Patch("verify/:uuid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "adminUsersVerify",
    description: "Verify a user's email by UUID (admin or self). V2-compatible."
  })
  @ApiParam({ name: "uuid", description: "User UUID" })
  @ApiResponse({ status: 200, description: "User verified", schema: { type: "string", example: "User verified." } })
  @ExceptionResponse(UnauthorizedException, { description: "Not authorized" })
  @ExceptionResponse(NotFoundException, { description: "No user found" })
  async verify(@Param("uuid") uuid: string, @Res() res: Response) {
    const user = await User.findOne({ where: { uuid }, attributes: ["id", "uuid"] });
    if (user == null) throw new NotFoundException("No user found.");

    await this.policyService.authorize("verify", user);
    await this.adminUsersService.verifyByUuid(uuid);

    return res.status(HttpStatus.OK).json("User verified.");
  }
}
