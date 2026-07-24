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

/** Endpoints HTTP de autenticación; las rutas @Public no requieren token. */
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Registra una cuenta nueva y devuelve el usuario con sus tokens. */
  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** Inicia sesión con email y contraseña. */
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Emite un nuevo par de tokens a partir de un refresh token válido. */
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body("refreshToken") refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  /** Inicia el flujo de recuperación de contraseña por email. */
  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /** Restablece la contraseña usando el token de recuperación. */
  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /** Cambia la contraseña del usuario autenticado. */
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser("userId") userId: string,
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(userId, dto);
  }

  /** Cierra la sesión del usuario autenticado. */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser("userId") userId: string) {
    return this.authService.logout(userId);
  }

  /** Devuelve el perfil del usuario autenticado. */
  @Get("me")
  async getMe(@CurrentUser("userId") userId: string) {
    return this.authService.getMe(userId);
  }
}
