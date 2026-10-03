import {Column, Entity, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {User} from "../../users/entities/user.entity";

@Entity('Roles')
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('string', { nullable: false, unique:true})
    name:string;

    @ManyToMany(() => User, (user) => user.roles)
    users: User[];
}