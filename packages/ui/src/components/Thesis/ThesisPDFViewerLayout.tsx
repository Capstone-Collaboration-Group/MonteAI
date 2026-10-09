// packages/ui/src/components/Thesis/ThesisPDFViewerLayout.tsx
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Calendar, Clock, FileDown, MessageSquare, Trash2, X } from "lucide-react";
import type {
  ThesisVersion,
  AnnotationResponseDto,
  CreateAnnotationDto,
  ResolveAnnotationDto,
  ThesisResponseDto,
  PanelistCandidate,
  CreateScheduleDto,
} from "@monteai/types";
import { Spinner } from "../common/Spinner";
import { ConfirmDialog } from "../common";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { VersionSelector } from "./VersionSelector";
import { PDFHighlightViewer, type PDFHighlightViewerHandle, type PdfOutlineItem } from "./PDFHighlightViewer";
import { Button } from "../Button";
import { PageLayout } from "../common";
import { ThesisPDFViewerSkeleton } from "./skeletons";
import type { ViewerRole } from "../../pages/ThesisPDFViewer";
import { ThesisStatusTimeline } from "../Thesis/ThesisStatusTime";
import { ScheduleDefenseModal } from "../Schedule";

interface ThesisPDFViewerLayoutProps {
  thesis: ThesisResponseDto | null;
  role: ViewerRole;
  versions: ThesisVersion[];
  activeVersion: ThesisVersion | null;
  fileUrl: string | null;
  annotations: AnnotationResponseDto[];
  unresolvedCount: number;
  resolvedCount: number;
  isLoading: boolean;
  isGenerating: boolean;
  isCreating: boolean;
  isResolving: boolean;
  canAnnotate: boolean;
  /** Show the delete-version button (leader/admin, latest version only). */
  canDeleteVersion?: boolean;
  deleteDialogOpen?: boolean;
  isDeletingVersion?: boolean;
  onRequestDelete?: () => void;
  /** Called when the user confirms inside the dialog. */
  onDeleteVersion?: () => void;
  onCancelDelete?: () => void;
  onVersionChange: (versionId: string) => void;
  onAddAnnotation: (dto: Omit<CreateAnnotationDto, "thesisVersionId">) => void;
  onResolve: (annotationId: string, dto: ResolveAnnotationDto) => void;
  onDelete: (annotationId: string) => void;
  onGenerateProceedings: () => void;
  onBack?: () => void;
  panelistPool?: PanelistCandidate[];
  scheduledBy?: string;
  onConfirmSchedule?: (data: CreateScheduleDto) => void | Promise<unknown>;
  onSubmitRevision?: () => void;
}

export function ThesisPDFViewerLayout({
  thesis,
  role,
  versions,
  activeVersion,
  fileUrl,
  annotations,
  unresolvedCount,
  resolvedCount,
  isLoading,
  isGenerating,
  isCreating,
  isResolving,
  canAnnotate,
  canDeleteVersion = false,
  deleteDialogOpen = false,
  isDeletingVersion = false,
  onRequestDelete,
  onDeleteVersion,
  onCancelDelete,
  onVersionChange,
  onAddAnnotation,
  onResolve,
  onDelete,
  onGenerateProceedings,
  onBack,
  onSubmitRevision,
  panelistPool,
  scheduledBy,
  onConfirmSchedule
}: ThesisPDFViewerLayoutProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sections, setSections] = useState<PdfOutlineItem[]>([]);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [mobileTimelineOpen, setMobileTimelineOpen] = useState(false);
  const [mobileAnnotationsOpen, setMobileAnnotationsOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const isIndexed =
    thesis?.status?.toLowerCase() === "indexed" ||
    thesis?.pineconeStatus?.toLowerCase() === "indexed";
  const canShowThesisWorkflow = thesis !== null && !isIndexed;

  const pdfViewerRef = useRef<PDFHighlightViewerHandle>(null);

  const handleJumpToPage = useCallback((page: number) => {
  setCurrentPage(page);
  pdfViewerRef.current?.scrollToPage(page);
}, []);

  return (
    <PageLayout className="relative">
      {/* ── Top Bar ── */}
      <header className="relative z-50 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-white px-3 py-2 sm:px-6 sm:py-4">
        <div className="flex w-full min-w-0 items-center justify-between gap-2 lg:w-auto">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {onBack && (
              <Button
                variant="ghost"
                type="button"
                onClick={onBack}
                className="flex shrink-0 items-center gap-1.5 !p-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back</span>
              </Button>
            )}
            {onBack && <div className="h-5 w-px shrink-0 bg-outline-variant" />}
            <h1 className="truncate font-sans text-base font-semibold text-on-surface sm:text-lg">
              Thesis Review
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            {thesis && (
              <button
                type="button"
                onClick={() => {
                  setMobileTimelineOpen(true);
                  setMobileAnnotationsOpen(false);
                }}
                aria-expanded={mobileTimelineOpen}
                aria-controls="mobile-thesis-timeline"
                className="flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
              >
                <Clock className="h-4 w-4" />
                Status
              </button>
            )}
            {canShowThesisWorkflow && (
              <button
                type="button"
                onClick={() => {
                  setMobileAnnotationsOpen(true);
                  setMobileTimelineOpen(false);
                }}
                aria-expanded={mobileAnnotationsOpen}
                aria-controls="mobile-thesis-annotations"
                className="flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
              >
                <MessageSquare className="h-4 w-4" />
                Notes
              </button>
            )}
          </div>
        </div>

        <div className="w-full min-w-0 overflow-x-auto lg:w-auto lg:overflow-visible">
          <div className="flex min-w-max items-center gap-2 lg:min-w-0 lg:gap-3">
          {canShowThesisWorkflow && (
            <VersionSelector
              versions={versions}
              activeVersion={activeVersion}
              onVersionChange={(id) => {
                onVersionChange(id);
                setCurrentPage(1);
              }}
            />
          )}

          {canShowThesisWorkflow && unresolvedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {unresolvedCount} unresolved
            </span>
          )}

          {/* ── Delete latest version (group leader / admin only) ── */}
          {canShowThesisWorkflow && canDeleteVersion && (
            <Button
              type="button"
              variant="danger"
              onClick={onRequestDelete}
              disabled={isDeletingVersion}
              className="flex shrink-0 items-center gap-1.5 text-sm"
            >
              <Trash2 className="h-4 w-4" />
              Delete Version
            </Button>
          )}

          {/* ── Schedule For Defense ── */}
          {role === "student" ? (
            canShowThesisWorkflow ? (
              <Button
                type="button"
                onClick={onSubmitRevision}
                className="flex shrink-0 items-center gap-2 text-sm"
              >
                Submit a Revised Version
              </Button>
            ) : null
          ) : (
            <Button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="flex shrink-0 items-center gap-2 text-sm"
            >
              <Calendar className="h-4 w-4" />
              Schedule For Defense
            </Button>
          )}

          {/* ── Generate Proceedings ── */}
          {canShowThesisWorkflow && (
            <Button
              type="button"
              onClick={onGenerateProceedings}
              disabled={isGenerating}
              className="flex items-center gap-2 text-sm"
            >
              {isGenerating ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {isGenerating ? "Generating…" : "Generate Proceedings"}
            </Button>
          )}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      {isLoading ? (
        <ThesisPDFViewerSkeleton onBack={onBack} />
      ) : !activeVersion || !fileUrl ? (
        <div className="flex flex-1 items-center justify-center text-outline">
          No thesis version available.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {thesis && (
            <div className="hidden h-full shrink-0 lg:flex">
              <ThesisStatusTimeline
                thesis={thesis}
                role={role}
                isCollapsed={timelineCollapsed}
                onToggle={() => setTimelineCollapsed((p) => !p)}
              />
            </div>
          )}

          <main className="min-w-0 flex-1 overflow-hidden">
            <PDFHighlightViewer
              ref={pdfViewerRef}
              fileUrl={fileUrl}
              annotations={annotations}
              isCreating={isCreating}
              canAnnotate={canAnnotate}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onOutlineChange={setSections}
              onAddAnnotation={onAddAnnotation}
              sections={sections}
              onSectionSelect={(item) => handleJumpToPage(item.page)}
            />
          </main>

          {canShowThesisWorkflow && (
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-outline-variant bg-white lg:block">
              <AnnotationSidebar
                annotations={annotations}
                unresolvedCount={unresolvedCount}
                resolvedCount={resolvedCount}
                isResolving={isResolving}
                onResolve={onResolve}
                onDelete={onDelete}
                onJumpToPage={handleJumpToPage}
              />
            </aside>
          )}
        </div>
      )}

      {mobileTimelineOpen && thesis && (
        <div className="absolute inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileTimelineOpen(false)}
            aria-label="Close thesis status panel"
          />
          <div
            id="mobile-thesis-timeline"
            className="relative z-10 h-full w-[min(16rem,85vw)] bg-white shadow-xl"
          >
            <ThesisStatusTimeline
              thesis={thesis}
              role={role}
              isCollapsed={false}
              onToggle={() => setMobileTimelineOpen(false)}
            />
          </div>
        </div>
      )}

      {mobileAnnotationsOpen && canShowThesisWorkflow && (
        <div className="absolute inset-0 z-40 flex justify-end lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileAnnotationsOpen(false)}
            aria-label="Close annotations panel"
          />
          <aside
            id="mobile-thesis-annotations"
            className="relative z-10 flex h-full w-[min(24rem,100vw)] flex-col bg-white shadow-xl"
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant px-4">
              <span className="text-sm font-semibold text-on-surface">Annotations</span>
              <button
                type="button"
                onClick={() => setMobileAnnotationsOpen(false)}
                aria-label="Close annotations panel"
                className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AnnotationSidebar
                annotations={annotations}
                unresolvedCount={unresolvedCount}
                resolvedCount={resolvedCount}
                isResolving={isResolving}
                onResolve={onResolve}
                onDelete={onDelete}
                onJumpToPage={handleJumpToPage}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ── Delete Version Confirmation ── */}
      {!isIndexed && (
        <ConfirmDialog
          open={deleteDialogOpen}
          variant="danger"
          title={`Delete Version ${activeVersion?.versionNumber ?? ""}?`}
          description={
            versions.length <= 1
              ? "This is the only version — deleting it will remove the entire thesis and all of its annotations. This cannot be undone."
              : "The version, its file, and its annotations will be removed. This cannot be undone."
          }
          confirmLabel="Delete"
          loading={isDeletingVersion}
          onConfirm={() => onDeleteVersion?.()}
          onCancel={() => onCancelDelete?.()}
        />
      )}

      {/* ── Schedule Defense Modal ── */}
      {thesis && (
        <ScheduleDefenseModal
  isOpen={scheduleModalOpen}
  onClose={() => setScheduleModalOpen(false)}
  scheduledBy={scheduledBy ?? ""}
  thesis={{
    id: thesis.id,  
    groupId: thesis.groupId,
    title: thesis.title ?? "",
    author: thesis.authors?.[0] ?? "",
    institute: thesis.institute ?? "",
    section: thesis.uploadedById,   // closest available field — swap if you have a better one
  }}
  panelistPool={panelistPool ?? []}
  onConfirm={(payload) => onConfirmSchedule?.(payload)}
/>
      )}
    </PageLayout>
  );
}