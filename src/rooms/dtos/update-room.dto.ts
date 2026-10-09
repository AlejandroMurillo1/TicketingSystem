import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from './create-room.dto';

/** Todos los campos son opcionales en la actualización */
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
