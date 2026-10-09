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
exports.Ticket = exports.TicketStatus = void 0;
const typeorm_1 = require("typeorm");
const reservation_entity_1 = require("../../reservations/entities/reservation.entity");
const seat_entity_1 = require("../../rooms/entities/seat.entity");
var TicketStatus;
(function (TicketStatus) {
    TicketStatus["VALID"] = "VALID";
    TicketStatus["USED"] = "USED";
    TicketStatus["CANCELLED"] = "CANCELLED";
})(TicketStatus || (exports.TicketStatus = TicketStatus = {}));
let Ticket = class Ticket {
    id;
    code;
    reservation;
    seat;
    status;
    createdAt;
};
exports.Ticket = Ticket;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Ticket.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', unique: true, nullable: false }),
    __metadata("design:type", String)
], Ticket.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => reservation_entity_1.Reservation, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'reservation_id' }),
    __metadata("design:type", reservation_entity_1.Reservation)
], Ticket.prototype, "reservation", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => seat_entity_1.Seat, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'seat_id' }),
    __metadata("design:type", seat_entity_1.Seat)
], Ticket.prototype, "seat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: TicketStatus, default: TicketStatus.VALID }),
    __metadata("design:type", String)
], Ticket.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Ticket.prototype, "createdAt", void 0);
exports.Ticket = Ticket = __decorate([
    (0, typeorm_1.Entity)('tickets')
], Ticket);
//# sourceMappingURL=ticket.entity.js.map