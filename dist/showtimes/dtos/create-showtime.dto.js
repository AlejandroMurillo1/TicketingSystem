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
exports.CreateShowtimeDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateShowtimeDto {
    movieId;
    roomId;
    startTime;
    price;
}
exports.CreateShowtimeDto = CreateShowtimeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'UUID de la película', format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateShowtimeDto.prototype, "movieId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'UUID de la sala', format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateShowtimeDto.prototype, "roomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha y hora de inicio (ISO 8601 con timezone)',
        example: '2026-11-01T20:00:00-05:00',
    }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateShowtimeDto.prototype, "startTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Precio base del tiquete', example: 15000 }),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateShowtimeDto.prototype, "price", void 0);
//# sourceMappingURL=create-showtime.dto.js.map