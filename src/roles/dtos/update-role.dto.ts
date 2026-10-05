import {PartialType} from "@nestjs/mapped-types";
import {CreateRole} from "./create-role.dto";

export class UpdateRole extends PartialType(CreateRole){}