import type { AuthUser } from "./auth";

export function isStudent(user: AuthUser): user is Extract<AuthUser, { role: "Student" }> { 
    return user.role === "Student";
}

export function isFaculty(user: AuthUser): user is Extract<AuthUser, { role: "Faculty" }> { 
    return user.role === "Faculty";
}

export function Admin(user: AuthUser): user is Extract<AuthUser, { role: "Admin" }> { 
    return user.role === "Admin";
}

export function ProgramHead(user: AuthUser): user is Extract<AuthUser, { role: "ProgramHead" }> { 
    return user.role === "ProgramHead";
}
