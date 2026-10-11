import {Column, Entity, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {User} from "../../users/entities/user.entity";

@Entity('roles')
export class Role {
    @PrimaryGeneratedColumn('identity')
    id: number;

    @Column({ type: 'varchar', length: 50, nullable: false, unique: true })
    name:string;

    @ManyToMany(() => User, (user) => user.roles)
    users?: User[];
}
