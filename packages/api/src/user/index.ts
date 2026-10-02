import type { AxiosInstance } from "axios";
import { mockUserService } from "./mockUserService";
import { LiveUserService } from "./userService";
import type { UserService } from "./types";

export function createUserService(
    client: AxiosInstance,
    useMock: boolean
): UserService {
    return useMock ? mockUserService : new LiveUserService(client);
}
export type { UserService } from "./types";
export { mockUserService } from "./mockUserService";
export { LiveUserService } from "./userService";
