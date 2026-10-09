"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRoomDto = exports.SeatLayoutDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const seat_entity_1 = require("../entities/seat.entity");
class SeatLayoutDto {
    row;
    column;
    type;
}
exports.SeatLayoutDto = SeatLayoutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fila del asiento (1-indexed)' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SeatLayoutDto.prototype, "row", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Columna del asiento (1-indexed)' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SeatLayoutDto.prototype, "column", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: seat_entity_1.SeatType, default: seat_entity_1.SeatType.NORMAL }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(seat_entity_1.SeatType),
    __metadata("design:type", String)
], SeatLayoutDto.prototype, "type", void 0);
class CreateRoomDto {
    name;
    rows;
    columns;
    specialSeats;
}
exports.CreateRoomDto = CreateRoomDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Nombre único de la sala', maxLength: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Número de filas', minimum: 1, maximum: 50 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Número de columnas', minimum: 1, maximum: 50 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "columns", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [SeatLayoutDto],
        description: 'Lista de asientos con tipo especial. El resto se genera automáticamente como NORMAL.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SeatLayoutDto),
    __metadata("design:type", Array)
], CreateRoomDto.prototype, "specialSeats", void 0);
//# sourceMappingURL=create-room.dto.js.map