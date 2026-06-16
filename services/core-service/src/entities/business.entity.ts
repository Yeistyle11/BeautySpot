import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { Branch } from "./branch.entity";
import { Professional } from "./professional.entity";
import { Service } from "./service.entity";
import { Client } from "./client.entity";
import { BusinessConfig } from "./business-config.entity";
import { BusinessHours } from "./business-hours.entity";

@Entity("businesses")
export class Business extends BaseEntity {
  @Column({ unique: true }) slug!: string;
  @Column() name!: string;
  @Column({ type: "text", nullable: true }) description!: string;
  @Column({ nullable: true }) logo!: string;
  @Column({ name: "cover_image", nullable: true }) coverImage!: string;
  @Column({ nullable: true }) phone!: string;
  @Column({ nullable: true }) email!: string;
  @Column({ nullable: true }) website!: string;
  @Column({ nullable: true }) address!: string;
  @Column({ nullable: true }) city!: string;
  @Column({ nullable: true }) state!: string;
  @Column({ nullable: true }) country!: string;
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true }) latitude!: number;
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true }) longitude!: number;
  @Column({ default: "America/Bogota" }) timezone!: string;
  @Column({ default: "COP" }) currency!: string;
  @Column({ default: "es-CO" }) locale!: string;
  @Column({ default: "BARBERIA" }) businessType!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ default: false }) verified!: boolean;
  @Column({ nullable: true }) planId!: string;

  @OneToMany(() => Branch, (b) => b.business) branches!: Branch[];
  @OneToMany(() => Professional, (p) => p.business) professionals!: Professional[];
  @OneToMany(() => Service, (s) => s.business) services!: Service[];
  @OneToMany(() => Client, (c) => c.business) clients!: Client[];
  @OneToMany(() => BusinessConfig, (c) => c.business) configs!: BusinessConfig[];
  @OneToMany(() => BusinessHours, (h) => h.business) hours!: BusinessHours[];
}
