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
exports.Showtime = void 0;
const typeorm_1 = require("typeorm");
const movie_entity_1 = require("../../movies/entities/movie.entity");
const room_entity_1 = require("../../rooms/entities/room.entity");
let Showtime = class Showtime {
    id;
    movie;
    room;
    startTime;
    price;
    createdAt;
};
exports.Showtime = Showtime;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Showtime.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => movie_entity_1.Movie, { nullable: false, onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'movie_id' }),
    __metadata("design:type", movie_entity_1.Movie)
], Showtime.prototype, "movie", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => room_entity_1.Room, { nullable: false, onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'room_id' }),
    __metadata("design:type", room_entity_1.Room)
], Showtime.prototype, "room", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: false }),
    __metadata("design:type", Date)
], Showtime.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, nullable: false }),
    __metadata("design:type", Number)
], Showtime.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Showtime.prototype, "createdAt", void 0);
exports.Showtime = Showtime = __decorate([
    (0, typeorm_1.Entity)('showtimes')
], Showtime);
//# sourceMappingURL=showtime.entity.js.map