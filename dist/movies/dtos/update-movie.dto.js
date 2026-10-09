"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMovie = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_movie_dto_1 = require("./create-movie.dto");
class UpdateMovie extends (0, mapped_types_1.PartialType)(create_movie_dto_1.CreateMovie) {
}
exports.UpdateMovie = UpdateMovie;
//# sourceMappingURL=update-movie.dto.js.map