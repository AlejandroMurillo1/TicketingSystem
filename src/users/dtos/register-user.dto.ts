import {IsArray, IsEmail, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString} from "class-validator";

export class RegisterUser {
    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email:string;

    @IsString()
    @IsNotEmpty()
    password:string;

    @IsString()
    @IsNotEmpty()
    fullName:string

    @IsArray()
    @IsOptional()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    roles?: number[];
}