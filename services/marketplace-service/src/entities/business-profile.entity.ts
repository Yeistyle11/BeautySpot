import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";

/** Enlaces a redes sociales del negocio. */
export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
}

/** Configuración de una sección del perfil inmersivo: si se muestra, su orden y título. */
export interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
  customTitle?: string;
}

/** Imagen de la galería del perfil, con su categoría y marca de destacada. */
export interface GalleryImage {
  url: string;
  title?: string;
  category?: string;
  featured?: boolean;
}

/** Perfil público del negocio en el marketplace: escaparate, historia, galería y métricas. */
@Entity("business_profiles")
@Index(["active", "isPublished"])
@Index(["city"])
export class BusinessProfileEntity extends TenantEntity {
  @Column({ unique: true }) slug!: string;

  @Column() name!: string;

  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ nullable: true }) logo!: string;

  @Column({ name: "cover_image", nullable: true }) coverImage!: string;

  @Column({ nullable: true }) phone!: string;

  @Column({ nullable: true }) email!: string;

  @Column({ type: "text", nullable: true }) address!: string;

  @Column({ nullable: true }) city!: string;

  @Column({ nullable: true }) state!: string;

  @Column({ nullable: true }) country!: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  lat!: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  lng!: number;

  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    transformer: numericTransformer,
    default: 0,
  })
  rating!: number;

  @Column({ name: "total_reviews", default: 0 }) totalReviews!: number;

  @Column({ name: "business_type", nullable: true }) businessType!: string;

  @Column({ default: true }) active!: boolean;

  @Column({ default: false }) verified!: boolean;

  // --- Campos de perfil inmersivo ---

  @Column({ type: "varchar", length: 80, nullable: true })
  tagline!: string;

  @Column({ type: "varchar", length: 100, nullable: true, name: "story_title" })
  storyTitle!: string;

  @Column({ type: "text", nullable: true, name: "story_text" })
  storyText!: string;

  @Column({ nullable: true, name: "story_image" })
  storyImage!: string;

  @Column({ type: "int", nullable: true, name: "founded_year" })
  foundedYear!: number;

  @Column({ nullable: true }) founders!: string;

  @Column({ type: "jsonb", nullable: true, name: "social_links" })
  socialLinks!: SocialLinks | null;

  @Column({ type: "jsonb", nullable: true, name: "section_config" })
  sectionConfig!: { sections: SectionConfig[] } | null;

  @Column({ type: "jsonb", nullable: true, name: "gallery_images" })
  galleryImages!: GalleryImage[] | null;

  @Column({ default: false, name: "is_published" })
  isPublished!: boolean;

  @Column({ type: "int", default: 0, name: "profile_completeness" })
  profileCompleteness!: number;

  // --- Relaciones: se consultan por businessId sin FK ---
}
