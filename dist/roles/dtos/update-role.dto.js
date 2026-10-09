"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRole = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_role_dto_1 = require("./create-role.dto");
class UpdateRole extends (0, mapped_types_1.PartialType)(create_role_dto_1.CreateRole) {
}
exports.UpdateRole = UpdateRole;
//# sourceMappingURL=update-role.dto.js.map