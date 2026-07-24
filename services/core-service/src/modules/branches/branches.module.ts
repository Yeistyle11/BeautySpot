import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BranchesService } from "./branches.service";
import { BranchesController } from "./branches.controller";
import { Branch } from "../../entities/branch.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Branch])],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
/** Cablea el CRUD de sedes del negocio. */
export class BranchesModule {}
