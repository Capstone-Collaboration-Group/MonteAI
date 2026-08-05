import type { AxiosInstance } from "axios";
import { mockAdminService } from "./mockAdminService";
import { LiveAdminService } from "./adminService";
import type { AdminService } from "./types";

export function createAdminService(
    client: AxiosInstance,
    useMock: boolean
): AdminService  {
    return useMock ? mockAdminService : new LiveAdminService(client)
}
export type { AdminService } from "./types";
export  { mockAdminService } from "./mockAdminService";
export {LiveAdminService } from "./adminService";