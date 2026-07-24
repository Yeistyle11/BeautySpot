import { Module } from "@nestjs/common";
import { PdfService } from "./pdf.service";

@Module({
  providers: [PdfService],
  exports: [PdfService],
})
/** Expone el PdfService para generar facturas en PDF. */
export class PdfModule {}
