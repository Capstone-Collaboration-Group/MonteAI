import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Circle, FileText, Lock } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatusBadge,
  type ThesisLifecycleStatus,
} from "@monteai/ui";
import { useMyThesis, useUserProfile } from "@monteai/hooks";
import type { AuthUser, ThesisResponseDto } from "@monteai/types";
import { profileService } from "../lib/authService";
import { thesisService } from "../lib/thesisService";
import { ThesisSubmissionModal } from "../components/ThesisSubmissionModal";

/** Maps raw API status strings ("Pending", "For Revision", "Published", ...) onto StatusBadge states. */
function toLifecycleStatus(status?: string): ThesisLifecycleStatus {
  switch (status?.trim().toLowerCase()) {
    case "under review":
    case "underreview":
      return "UnderReview";
    case "approved":
      return "Approved";
    case "scheduled":
      return "Scheduled";
    case "revision":
      return "Revision";
    case "rejected":
      return "Rejected";
    case "indexed":
    case "published":
      return "Indexed";
    default:
      return "Pending";
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface Milestone {
  label: string;
  date?: string;
}

/** Mirrors the viewer's ThesisStatusTime timeline; rejected submissions end at Rejected. */
function buildMilestones(thesis: ThesisResponseDto, rejected: boolean): Milestone[] {
  if (rejected) {
    return [
      { label: "Submitted", date: thesis.submittedAt },
      { label: "Under Review", date: thesis.reviewedAt },
      { label: "Rejected", date: thesis.rejectedAt },
    ];
  }
  return [
    { label: "Submitted", date: thesis.submittedAt },
    { label: "Under Review", date: thesis.reviewedAt },
    { label: "Approved", date: thesis.approvedAt },
    { label: "Scheduled", date: thesis.scheduledAt },
    { label: "Published", date: thesis.indexedAt },
  ];
}

export default function SubmitThesis() {
  const navigate = useNavigate();
  const { profile: rawProfile, isLoading: profileLoading, error: profileError } =
    useUserProfile(profileService);
  // react-query types the hook profile as NoInfer<AuthUser>, which blocks the
  // ternary's discriminant narrowing — re-bind to the plain union first.
  const profile: AuthUser | null = rawProfile;

  const studentProfile = profile?.role === "Student" ? profile : null;
  const isStudent = studentProfile !== null;
  const position = studentProfile?.position;
  const isLeader = !!position && position.trim().toLowerCase() === "leader";
  const groupName = studentProfile?.researchGroup?.groupName;

  const {
    thesis: myThesis,
    isLoading: thesisLoading,
    error: thesisError,
  } = useMyThesis(thesisService, isStudent);

  const [modalMode, setModalMode] = useState<"initial" | "revision" | null>(null);

  if (profileLoading || (isStudent && thesisLoading)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-container-low/60">
        <Spinner size="xl" />
        <p className="text-sm text-on-surface-variant">
          Loading your submission...
        </p>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low/60 px-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            We couldn't load your profile. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  // Non-students never call /thesis/my, so they always see the empty state.
  const thesis = isStudent ? myThesis : null;
  const lifecycle = toLifecycleStatus(thesis?.status);
  const rejected = lifecycle === "Rejected";
  const milestones = thesis ? buildMilestones(thesis, rejected) : [];

  return (
    <div className="min-h-screen bg-surface-container-low/60 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <PageHeader
          eyebrow="Thesis Submission"
          title="My Submission"
          actions={
            thesis && isLeader ? (
              <Button variant="primary" onClick={() => setModalMode("revision")}>
                Submit Revision
              </Button>
            ) : undefined
          }
        />

        {thesisError ? (
          <Card className="p-6 text-center text-sm text-on-surface-variant">
            We couldn't load your submission. Please try again later.
          </Card>
        ) : !thesis ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No submitted thesis yet"
            description={
              isStudent
                ? "Your research group hasn't submitted a manuscript. Once submitted, you can track its application status on this page."
                : "Thesis submissions are tracked here for student research groups."
            }
            action={
              isStudent ? (
                <Button variant="primary" onClick={() => setModalMode("initial")}>
                  Submit Thesis
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Card className="min-w-0 flex-1 space-y-5 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Submitted manuscript
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-on-surface">
                    {thesis.title || "Untitled"}
                  </h3>
                </div>
                <StatusBadge status={lifecycle} className="shrink-0" />
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Research group
                  </dt>
                  <dd className="mt-0.5 font-medium text-on-surface">
                    {groupName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Institute
                  </dt>
                  <dd className="mt-0.5 font-medium text-on-surface">
                    {thesis.institute || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Authors
                  </dt>
                  <dd className="mt-0.5 font-medium text-on-surface">
                    {thesis.authors?.length ? thesis.authors.join(", ") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Submitted
                  </dt>
                  <dd className="mt-0.5 font-medium text-on-surface">
                    {formatDate(thesis.submittedAt) || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Status
                  </dt>
                  <dd className="mt-0.5 font-medium text-on-surface">
                    {lifecycle}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Abstract
                </p>
                <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-on-surface-variant">
                  {thesis.abstract || "No abstract provided."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/60 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/thesis/view/${thesis.id}`)}
                >
                  Open thesis
                </Button>
                {!isLeader && (
                  <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Only the group leader can edit this submission.
                  </p>
                )}
              </div>
            </Card>

            <Card className="w-full shrink-0 space-y-4 p-6 lg:w-80">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Application status
              </p>
              <ul className="space-y-3">
                {milestones.map((milestone) => {
                  const done = !!milestone.date;
                  const iconClass = !done
                    ? "text-outline"
                    : milestone.label === "Rejected"
                      ? "text-error"
                      : "text-primary";
                  return (
                    <li key={milestone.label} className="flex items-start gap-3">
                      {done ? (
                        <CheckCircle className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                      ) : (
                        <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                      )}
                      <span
                        className={`flex-1 text-sm font-medium ${
                          done ? "text-on-surface" : "text-on-surface-variant"
                        }`}
                      >
                        {milestone.label}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(milestone.date)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}
      </div>

      <ThesisSubmissionModal
        open={modalMode !== null}
        mode={modalMode === "revision" ? "revision" : "initial"}
        thesisId={thesis?.id}
        onClose={() => setModalMode(null)}
      />
    </div>
  );
}
