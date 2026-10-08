import {IsInt, IsNotEmpty,IsOptional,IsString, Min} from "class-validator";

export class CreateMovie {
    @IsString()
    @IsNotEmpty()
    title:string;

    @IsString()
    @IsNotEmpty()
    synopsis:string;

    @IsInt()
    @Min(1)
    durationMinutes:number;

    @IsString()
    @IsNotEmpty()
    genre:string;

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    rating:string;

}