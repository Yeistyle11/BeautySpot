import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";

export interface PortfolioItem {
  url: string;
  title?: string;
  category?: string;
}

@Entity("professional_profiles")
export class ProfessionalProfileEntity extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" })
  @Index()
  professionalId!: string;

  // Datos basicos sincronizados desde core-service
  @Column() name!: string;

  @Column({ nullable: true }) photo!: string;

  @Column({ type: "text", nullable: true }) bio!: string;

  @Column({ type: "simple-array" }) specialties!: string[];

  @Column({ name: "years_exp", default: 0 }) yearsExp!: number;

  // Datos configurables desde el panel del negocio
  @Column({ nullable: true }) tagline!: string;

  @Column({ type: "jsonb", nullable: true }) portfolio!: PortfolioItem[] | null;

  @Column({ name: "social_instagram", nullable: true })
  socialInstagram!: string;

  // Slug para URL publica SEO-friendly
  @Column({ unique: true, nullable: true }) slug!: string;

  // Visibilidad en el perfil publico del marketplace (controlado por el dueno)
  @Column({ name: "visible_on_profile", default: true })
  visibleOnProfile!: boolean;

  // Metricas calculadas
  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    transformer: numericTransformer,
    default: 0,
  })
  rating!: number;

  @Column({ name: "total_reviews", default: 0 }) totalReviews!: number;

  @Column({ default: true }) active!: boolean;
}
