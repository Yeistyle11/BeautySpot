import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto";

@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("branches")
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  async create(@BusinessId() businessId: string, @Body() dto: CreateBranchDto) {
    return this.service.create(businessId, dto);
  }

  @Get()
  async findAll(@BusinessId() businessId: string) {
    return this.service.findByBusiness(businessId);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateBranchDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  @Delete(":id")
  async deactivate(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.deactivate(id, businessId);
    return { message: "Sucursal desactivada" };
  }
}
