import type { 
    AdminResponseDto,
    UpdateAdminDto,
} from "@monteai/types";

export interface AdminService { 
    getAdmins(): Promise<AdminResponseDto[] | []>;
    getAdmin(adminId: string): Promise<AdminResponseDto | null>;
    updateAdmin(adminId: string, dto: UpdateAdminDto): Promise<boolean>;
    
    // add delete soon;
}