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
exports.SeatHold = exports.SeatHoldStatus = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
const showtime_entity_1 = require("../../showtimes/entities/showtime.entity");
const seat_entity_1 = require("../../rooms/entities/seat.entity");
var SeatHoldStatus;
(function (SeatHoldStatus) {
    SeatHoldStatus["ACTIVE"] = "ACTIVE";
    SeatHoldStatus["EXPIRED"] = "EXPIRED";
    SeatHoldStatus["CONFIRMED"] = "CONFIRMED";
})(SeatHoldStatus || (exports.SeatHoldStatus = SeatHoldStatus = {}));
let SeatHold = class SeatHold {
    id;
    user;
    showtime;
    seat;
    status;
    expiresAt;
    createdAt;
};
exports.SeatHold = SeatHold;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SeatHold.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], SeatHold.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => showtime_entity_1.Showtime, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'showtime_id' }),
    __metadata("design:type", showtime_entity_1.Showtime)
], SeatHold.prototype, "showtime", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => seat_entity_1.Seat, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'seat_id' }),
    __metadata("design:type", seat_entity_1.Seat)
], SeatHold.prototype, "seat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: SeatHoldStatus, default: SeatHoldStatus.ACTIVE }),
    __metadata("design:type", String)
], SeatHold.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: false }),
    __metadata("design:type", Date)
], SeatHold.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SeatHold.prototype, "createdAt", void 0);
exports.SeatHold = SeatHold = __decorate([
    (0, typeorm_1.Entity)('seat_holds')
], SeatHold);
//# sourceMappingURL=seat-hold.entity.js.map