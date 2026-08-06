// packages/api/src/submission/mockSubmissionService.ts

import type { SubmissionService } from "./types";
import type {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  SubmissionResponseDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockSubmissionService loaded — Initialized with seed data");

function buildSeed(): SubmissionResponseDto[] {
  return [
    {
      id: "submission-1",
      thesisId: "thesis-1",
      studentNumber: "2023-00001",
      studentName: "John Doe",
      thesisTitle: "AI-Driven Student Performance Prediction",
      submittedAt: "2025-02-10T08:00:00.000Z",
      notes: "Initial submission.",
    },
    {
      id: "submission-2",
      thesisId: "thesis-2",
      studentNumber: "2023-00002",
      studentName: "Jane Smith",
      thesisTitle: "Smart Attendance Monitoring System",
      submittedAt: "2025-02-15T09:30:00.000Z",
      notes: "Revised manuscript.",
    },
    {
      id: "submission-3",
      thesisId: "thesis-3",
      studentNumber: "2023-00003",
      studentName: "Michael Tan",
      thesisTitle: "Blockchain-Based Academic Records Management",
      submittedAt: "2025-02-20T10:15:00.000Z",
      notes: "Final submission.",
    },
  ];
}

const submissionsMap = new Map<string, SubmissionResponseDto>();

buildSeed().forEach((submission) =>
  submissionsMap.set(submission.id, submission)
);

export const mockSubmissionService: SubmissionService = {
  async getSubmissions() {
    await delay(300);
    return Array.from(submissionsMap.values());
  },

  async getSubmission(submissionId: string) {
    await delay(150);
    return submissionsMap.get(submissionId) ?? null;
  },

  async createSubmission(dto: CreateSubmissionDto) {
    await delay(300);

    const id = crypto.randomUUID();

    const submission: SubmissionResponseDto = {
      id,
      thesisId: dto.thesisId,
      studentNumber: dto.studentNumber,
      notes: dto.notes,
      submittedAt: new Date().toISOString(),
    };

    submissionsMap.set(id, submission);

    return true;
  },

  async updateSubmission(
    submissionId: string,
    dto: UpdateSubmissionDto
  ) {
    await delay(300);

    const existing = submissionsMap.get(submissionId);

    if (!existing) {
      return false;
    }

    submissionsMap.set(submissionId, {
      ...existing,
      ...dto,
    });

    return true;
  },

  async deleteSubmission(submissionId: string) {
    await delay(200);
    return submissionsMap.delete(submissionId);
  },
};