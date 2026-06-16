import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { Professional } from "./professional.entity";
import { Service } from "./service.entity";

@Entity("professional_services")
@Unique(["professionalId", "serviceId"])
export class ProfessionalService extends BaseEntity {
  @Column({ type: "uuid", name: "professional_id" }) professionalId!: string;
  @Column({ type: "uuid", name: "service_id" }) serviceId!: string;
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, name: "custom_price" }) customPrice!: number;
  @Column({ nullable: true, name: "custom_duration" }) customDuration!: number;

  @ManyToOne(() => Professional, { onDelete: "CASCADE" })
  @JoinColumn({ name: "professional_id" })
  professional!: Professional;

  @ManyToOne(() => Service)
  @JoinColumn({ name: "service_id" })
  service!: Service;
}
