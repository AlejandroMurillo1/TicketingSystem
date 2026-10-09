import { DataSource, Repository } from "typeorm";
import { Role } from "./entities/role.entity";
import { CreateRole } from "./dtos/create-role.dto";
import { FindAllRoles } from "./dtos/role-pagination.dto";
import { UpdateRole } from "./dtos/update-role.dto";
export declare class RolesService {
    private readonly roleRepository;
    private readonly dataSource;
    private readonly logger;
    constructor(roleRepository: Repository<Role>, dataSource: DataSource);
    createRole(createRoleDto: CreateRole): Promise<Role | undefined>;
    findAll(paginationDto: FindAllRoles): Promise<Role[] | undefined>;
    findById(id: number): Promise<Role | undefined>;
    findByName(name: string): Promise<Role | undefined>;
    updateRole(id: number, updateRoleDto: UpdateRole): Promise<Role | undefined>;
    removeRole(id: number): Promise<void>;
    bulkCreateRole(createRoleList: CreateRole[]): Promise<Role[] | undefined>;
    private handleException;
}
