import { Entity, Column, OneToMany } from "typeorm";
import { Exclude } from "class-transformer";
import { BaseEntity } from "@beautyspot/database";
import { Membership } from "./membership.entity";
import { PasswordReset } from "./password-reset.entity";

/** Cuenta de usuario de la plataforma: credenciales, perfil y sus membresías a negocios. */
@Entity("users")
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Exclude()
  @Column()
  password!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true })
  avatar!: string;

  @Column({ default: false, name: "email_verified" })
  emailVerified!: boolean;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: "uuid", nullable: true, name: "current_business_id" })
  currentBusinessId!: string;

  /**
   * Versión de los JWT del usuario. Al incrementarse, todos los tokens
   * emitidos con la versión anterior quedan invalidados (ver TokenVersionStore).
   */
  @Column({ type: "int", default: 0, name: "token_version" })
  tokenVersion!: number;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships!: Membership[];

  @OneToMany(() => PasswordReset, (reset) => reset.user)
  passwordResets!: PasswordReset[];
}
