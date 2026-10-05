import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn
} from "typeorm";
import {Role} from "../../roles/entities/role.entity";
import {Exclude} from "class-transformer";

@Entity('Users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column({ nullable: false, unique: true })
    email: string;

    @Column( {nullable:false})
    @Exclude()
    password?:string;

    @Column({ nullable:false})
    fullName:string;

    @CreateDateColumn()
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