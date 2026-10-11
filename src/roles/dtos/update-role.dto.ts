import {PartialType} from "@nestjs/swagger";
import {CreateRole} from "./create-role.dto";

export class UpdateRole extends PartialType(CreateRole){}
