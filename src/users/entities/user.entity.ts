import {BeforeInsert, BeforeUpdate, Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {Role} from "../../roles/entities/role.entity";
import {Exclude} from "class-transformer";

@Entity('Users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column('string', { nullable: false, unique:true})
    email:string;

    @Column('string', {nullable:false})
    @Exclude()
    password?:string;

    @Column('string', { nullable:false})
    fullName:string;

    @Column('datetime', { nullable:false})
    createdAt:Date;

    @ManyToMany(() => Role, (role) => role.users)
    @JoinTable({name: 'user_role'})
    roles: Role[];

    @BeforeInsert()
    @BeforeUpdate()
    checkEmailBeforeChanges(){
        this.email = this.email
            .toLowerCase()
            .trim();
    }
}