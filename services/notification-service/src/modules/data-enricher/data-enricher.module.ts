import { Module } from "@nestjs/common";
import { DataEnricherService } from "./data-enricher.service";

@Module({
  providers: [DataEnricherService],
  exports: [DataEnricherService],
})
export class DataEnricherModule {}
