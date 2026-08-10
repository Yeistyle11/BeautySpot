import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { BusinessProfileEntity } from "./entities/business-profile.entity";
import { ReviewEntity } from "./entities/review.entity";
import { ReviewReportEntity } from "./entities/review-report.entity";
import { ProfessionalProfileEntity } from "./entities/professional-profile.entity";
import { ReviewHelpfulEntity } from "./entities/review-helpful.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  BusinessProfileEntity,
  ReviewEntity,
  ReviewReportEntity,
  ProfessionalProfileEntity,
  ReviewHelpfulEntity,
  OutboxMessageEntity,
];
