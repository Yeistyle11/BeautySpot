import { Entity, Column, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { User } from "./user.entity";

/** Token de verificación de correo (solo su hash), con vencimiento y marca de uso. */
@Entity("email_verifications")
export class EmailVerification extends BaseEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ unique: true, name: "token_hash" })
  tokenHash!: string;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true, name: "used_at" })
  usedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;
}
