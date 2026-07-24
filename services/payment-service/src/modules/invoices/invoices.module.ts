import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { PdfModule } from "./pdf/pdf.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceEntity, InvoiceItemEntity]),
    PdfModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
/** Cablea la gestión de facturas y su generación en PDF. */
export class InvoicesModule {}
