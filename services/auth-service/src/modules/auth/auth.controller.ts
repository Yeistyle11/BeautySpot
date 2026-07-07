import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { Public, CurrentUser } from "@beautyspot/nest-common";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body("refreshToken") refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser("userId") userId: string,
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser("userId") userId: string) {
    return this.authService.logout(userId);
  }

  @Get("me")
  async getMe(@CurrentUser("userId") userId: string) {
    return this.authService.getMe(userId);
  }
}
