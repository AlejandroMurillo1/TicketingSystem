"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateShowtimeDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_showtime_dto_1 = require("./create-showtime.dto");
class UpdateShowtimeDto extends (0, mapped_types_1.PartialType)(create_showtime_dto_1.CreateShowtimeDto) {
}
exports.UpdateShowtimeDto = UpdateShowtimeDto;
//# sourceMappingURL=update-showtime.dto.js.map