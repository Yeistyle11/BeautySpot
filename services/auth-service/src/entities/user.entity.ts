import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { Membership } from "./membership.entity";
import { PasswordReset } from "./password-reset.entity";

@Entity("users")
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

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

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships!: Membership[];

  @OneToMany(() => PasswordReset, (reset) => reset.user)
  passwordResets!: PasswordReset[];
}
