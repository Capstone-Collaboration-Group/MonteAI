// packages/api/src/announcement/mockAnnouncementService.ts

import type { AnnouncementService } from "./types";
import type {
  AnnouncementResponseDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockAnnouncementService loaded — Initialized with seed data");

function buildSeed(): AnnouncementResponseDto[] {
  return [
    {
      id: "announcement-1",
      subject: "Welcome to MonteAI",
      content:
        "Welcome to the MonteAI Research Management System. Stay tuned for upcoming thesis schedules and announcements.",
      attachmentUrls: [],
      createdAt: "2025-01-15T08:00:00.000Z",
      lastModified: "2025-01-15T08:00:00.000Z",
      author: {
        id: "admin-1",
        fullName: "Juan Dela Cruz",
        role: "Research Coordinator",
      },
    },
    {
      id: "announcement-2",
      subject: "Thesis Submission Deadline",
      content:
        "The deadline for thesis proposal submission is on September 15, 2025. Please upload all required documents before the deadline.",
      attachmentUrls: [
        "https://example.com/files/thesis-guidelines.pdf",
      ],
      createdAt: "2025-02-01T10:30:00.000Z",
      lastModified: "2025-02-01T10:30:00.000Z",
      author: {
        id: "admin-2",
        fullName: "Maria Santos",
        role: "Department Secretary",
      },
    },
    {
      id: "announcement-3",
      subject: "Research Defense Schedule",
      content:
        "The schedule for the Midterm Research Defense has been published. Please check your assigned room and time.",
      attachmentUrls: [],
      createdAt: "2025-02-18T09:15:00.000Z",
      lastModified: "2025-02-18T09:15:00.000Z",
      author: {
        id: "admin-3",
        fullName: "Robert Garcia",
        role: "System Administrator",
      },
    },
  ];
}

const announcementsMap = new Map<string, AnnouncementResponseDto>();

buildSeed().forEach((announcement) =>
  announcementsMap.set(announcement.id, announcement)
);

export const mockAnnouncementService: AnnouncementService = {
  async getAnnouncements() {
    await delay(300);
    return Array.from(announcementsMap.values());
  },

  async getAnnouncement(announcementId: string) {
    await delay(150);
    return announcementsMap.get(announcementId) ?? null;
  },

  async createAnnouncement(dto: CreateAnnouncementDto) {
    await delay(300);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newAnnouncement: AnnouncementResponseDto = {
      id,
      subject: dto.subject,
      content: dto.content,
      attachmentUrls: dto.attachmentUrls,
      createdAt: dto.createdAt ?? now,
      lastModified: dto.lastModified ?? now,
      author: {
        id: "admin-1",
        fullName: "Juan Dela Cruz",
        role: "Research Coordinator",
      },
    };

    announcementsMap.set(id, newAnnouncement);

    return newAnnouncement;
  },

  async updateAnnouncement(
    announcementId: string,
    dto: UpdateAnnouncementDto
  ) {
    await delay(300);

    const existing = announcementsMap.get(announcementId);

    if (!existing) {
      return false;
    }

    announcementsMap.set(announcementId, {
      ...existing,
      ...dto,
      lastModified: dto.lastModified ?? new Date().toISOString(),
    });

    return true;
  },

  async deleteAnnouncement(announcementId: string) {
    await delay(200);
    return announcementsMap.delete(announcementId);
  },
};