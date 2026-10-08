import {IsInt, IsOptional, IsPositive, IsString, Max, MaxLength, Min} from "class-validator";
import {Type} from "class-transformer";

export class FindAllMovies {
    @IsInt()
    @IsOptional()
    @IsPositive()
    @Max(100)
    @Type(() => Number)
    limit?: number;

    @IsInt()
    @IsOptional()
    @Min(0)
    @Type(() => Number)
    offset?: number;

    @IsString()
    @IsOptional()
    @MaxLength(150)
    title?: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    genre?: string;
}