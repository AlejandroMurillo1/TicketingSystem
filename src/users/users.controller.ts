import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUser } from './dtos/create-user.dto';
import { UpdateProfile } from './dtos/update-profile.dto';
import { AssignRoles } from './dtos/assign-roles.dto';
import { UpdateUserStatus } from './dtos/update-user-status.dto';
import { FindAllUsers } from './dtos/user-pagination.dto';
import { Auth, GetUser } from '../common/decorators';
import { ValidRoles } from '../common/enums/valid-roles.enum';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Profile of the authenticated user' })
  getMe(@GetUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @Auth()
  @ApiOperation({ summary: 'Update own profile (name, email or password)' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  updateMe(@GetUser('id') userId: string, @Body() dto: UpdateProfile) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Create a user with explicit roles (e.g. counter staff)' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  create(@Body() dto: CreateUser) {
    return this.usersService.create(dto);
  }

  @Get()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'List users (paginated, optional role filter)' })
  findAll(@Query() pagination: FindAllUsers) {
    return this.usersService.findAll(pagination);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getProfile(id);
  }

  @Patch(':id/roles')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Replace the roles of a user (RF2)' })
  @ApiResponse({ status: 400, description: 'Unknown role name' })
  assignRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoles) {
    return this.usersService.assignRoles(id, dto.roles);
  }

  @Patch(':id/status')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatus) {
    return this.usersService.setActive(id, dto.isActive);
  }
}
