import type { UserProfileDto, UpdateProfileRequest } from "@monteai/types";

export interface UserService {
    /** Profile of the authenticated user (resolved server-side by role). */
    getMe(): Promise<UserProfileDto | null>;
    /** Partially update the authenticated user's profile. Returns the updated profile. */
    updateMe(dto: UpdateProfileRequest): Promise<UserProfileDto | null>;
    /** Revoke all Firebase refresh tokens for the authenticated user (signs out every device). */
    revokeSessions(): Promise<boolean>;
}
