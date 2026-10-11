import {ApiPropertyOptional} from "@nestjs/swagger";
import {IsInt, IsOptional, IsPositive, Min} from "class-validator";
import {Type} from "class-transformer";

export class FindAllRoles {
    @ApiPropertyOptional({ example: 10 })
    @IsInt()
    @IsOptional()
    @IsPositive()
    @Type(() => Number)
    limit:number;

    @ApiPropertyOptional({ example: 0 })
    @IsInt()
    @IsOptional()
    @Min(0)
    @Type(() => Number)
    offset:number;
}
