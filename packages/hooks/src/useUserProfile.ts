import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { ProfileService } from "../../api/src/auth/profileService";

export function useUserProfile(profileService: ProfileService) { 
    const { user, loading: authLoading } = useAuth();

    const query = useQuery({
        queryKey: ["userProfile", user?.uid],
        queryFn: () => profileService.getCurrentProfile(),
        enabled: !!user && !authLoading,
    });

    return {
        profile: query.data ?? null,
        isLoading: authLoading || query.isLoading,
        error: query.error,
    };
}