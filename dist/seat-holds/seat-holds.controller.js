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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatHoldsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const seat_holds_service_1 = require("./seat-holds.service");
const create_seat_hold_dto_1 = require("./dtos/create-seat-hold.dto");
let SeatHoldsController = class SeatHoldsController {
    seatHoldsService;
    constructor(seatHoldsService) {
        this.seatHoldsService = seatHoldsService;
    }
    create(dto) {
        return this.seatHoldsService.holdSeats(dto);
    }
    findAll() {
        return this.seatHoldsService.findAll();
    }
};
exports.SeatHoldsController = SeatHoldsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Bloquear temporalmente asientos para una función (Concurrency Safe)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Asientos bloqueados exitosamente' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Uno o más asientos ya están tomados' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_seat_hold_dto_1.CreateSeatHoldDto]),
    __metadata("design:returntype", void 0)
], SeatHoldsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todos los bloqueos (Debug)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SeatHoldsController.prototype, "findAll", null);
exports.SeatHoldsController = SeatHoldsController = __decorate([
    (0, swagger_1.ApiTags)('seat-holds'),
    (0, common_1.Controller)('seat-holds'),
    __metadata("design:paramtypes", [seat_holds_service_1.SeatHoldsService])
], SeatHoldsController);
//# sourceMappingURL=seat-holds.controller.js.map