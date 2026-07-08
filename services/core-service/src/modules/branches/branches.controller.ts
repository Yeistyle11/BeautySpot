import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto";

@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("branches")
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBranchDto) {
    return this.service.create(req.businessId, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.service.findByBusiness(req.businessId);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: UpdateBranchDto
  ) {
    return this.service.update(id, req.businessId, dto);
  }

  @Delete(":id")
  async deactivate(@Param("id") id: string, @Req() req: any) {
    await this.service.deactivate(id, req.businessId);
    return { message: "Sucursal desactivada" };
  }
}
