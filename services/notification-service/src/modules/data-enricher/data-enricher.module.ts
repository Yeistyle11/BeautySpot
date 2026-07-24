import { Module } from "@nestjs/common";
import { DataEnricherService } from "./data-enricher.service";

@Module({
  providers: [DataEnricherService],
  exports: [DataEnricherService],
})
/** Expone el DataEnricherService que resuelve ids a nombres vía el core. */
export class DataEnricherModule {}
