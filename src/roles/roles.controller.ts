import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRole } from './dtos/create-role.dto';
import { UpdateRole } from './dtos/update-role.dto';
import { FindAllRoles } from './dtos/role-pagination.dto';
import { Auth } from '../common/decorators';
import { ValidRoles } from '../common/enums/valid-roles.enum';

@ApiTags('roles')
@Auth(ValidRoles.ADMIN)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  create(@Body() dto: CreateRole) {
    return this.rolesService.createRole(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create several roles in one transaction' })
  @ApiBody({ type: [CreateRole] })
  bulkCreate(@Body(new ParseArrayPipe({ items: CreateRole })) dtos: CreateRole[]) {
    return this.rolesService.bulkCreateRole(dtos);
  }

  @Get()
  @ApiOperation({ summary: 'List roles (paginated)' })
  findAll(@Query() pagination: FindAllRoles) {
    return this.rolesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by id' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a role' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRole) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role that has no users' })
  @ApiResponse({ status: 409, description: 'Role is still assigned to users' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.removeRole(id);
  }
}
