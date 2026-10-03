import {IsEmail, IsNotEmpty, IsString} from "class-validator";

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
}