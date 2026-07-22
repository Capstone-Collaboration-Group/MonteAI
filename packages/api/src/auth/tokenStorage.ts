import type { AuthTokens } from "@monteai/types/src/auth";

export interface TokenStorage { 
    getTokens(): Promise<AuthTokens | null>;
    setTokens(tokens: AuthTokens): Promise<void>;
    clearTokens(): Promise<void>;
}

export function createInMemoryTokenStorage(): TokenStorage { 
    let current: AuthTokens | null = null;
    return { 
        async getTokens() { 
            return current;
        },
        async setTokens(tokens) { 
            current = tokens;
        },
        async clearTokens() { 
            current = null;
        },
    };
}