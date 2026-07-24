import { Entity, Column, ManyToOne, Unique, JoinColumn } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Role } from "@beautyspot/shared-types";
import { User } from "./user.entity";

/** Vínculo usuario–negocio con su rol; un usuario puede pertenecer a varios negocios. */
@Entity("memberships")
@Unique(["userId", "businessId"])
export class Membership extends TenantEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "enum", enum: Role, default: Role.CLIENT })
  role!: Role;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: "uuid", nullable: true, name: "invited_by" })
  invitedBy!: string;

  @Column({ type: "timestamp", nullable: true, name: "accepted_at" })
  acceptedAt!: Date;

  @ManyToOne(() => User, (user) => user.memberships)
  @JoinColumn({ name: "user_id" })
  user!: User;
}
