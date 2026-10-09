"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatHoldsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const seat_hold_entity_1 = require("./entities/seat-hold.entity");
const seat_holds_service_1 = require("./seat-holds.service");
const seat_holds_controller_1 = require("./seat-holds.controller");
let SeatHoldsModule = class SeatHoldsModule {
};
exports.SeatHoldsModule = SeatHoldsModule;
exports.SeatHoldsModule = SeatHoldsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([seat_hold_entity_1.SeatHold])],
        controllers: [seat_holds_controller_1.SeatHoldsController],
        providers: [seat_holds_service_1.SeatHoldsService],
        exports: [seat_holds_service_1.SeatHoldsService],
    })
], SeatHoldsModule);
//# sourceMappingURL=seat-holds.module.js.map