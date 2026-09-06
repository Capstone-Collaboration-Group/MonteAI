export interface AnnouncementAuthorDto {
  id: string;
  fullName: string;
  role: string;
}

export interface CreateAnnouncementDto {
  subject: string;
  content: string;
   category: string;
  institute: string;
  priority: "Normal" | "Important" | "Urgent";
  attachmentUrls: string[];
  createdAt?: string;
  lastModified?: string;
}

export interface UpdateAnnouncementDto {
  subject: string;
  content: string;
  category: string;
  institute: string;
  priority: "Normal" | "Important" | "Urgent";
  attachmentUrls: string[];
  lastModified?: string;
}

export interface AnnouncementResponseDto {
  id: string;
  subject: string;
  content: string;
  category: string;
  institute: string;
  priority: "Normal" | "Important" | "Urgent";
  attachmentUrls: string[];
  createdAt?: string;
  lastModified?: string;
  author: AnnouncementAuthorDto;
}

export type AnnouncementResponseListDto = AnnouncementResponseDto[];
