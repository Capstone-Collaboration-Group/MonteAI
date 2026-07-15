
export interface CreateAdminDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  position: string;
}

export interface UpdateAdminDto {
  email?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  position?: string;
  isActive?: boolean;
}

export interface AdminResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  position: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}