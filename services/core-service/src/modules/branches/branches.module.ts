import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BranchesService } from "./branches.service";
import { BranchesController } from "./branches.controller";
import { InternalBranchesController } from "./internal-branches.controller";
import { Branch } from "../../entities/branch.entity";
import { Professional } from "../../entities/professional.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Professional])],
  controllers: [BranchesController, InternalBranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
/** Cablea el CRUD de sedes del negocio. */
export class BranchesModule {}
