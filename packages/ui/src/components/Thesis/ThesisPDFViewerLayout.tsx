// packages/ui/src/components/Thesis/ThesisPDFViewerLayout.tsx
import { useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import type {
  ThesisVersion,
  AnnotationResponseDto,
  CreateAnnotationDto,
  ResolveAnnotationDto,
  ThesisResponseDto,
} from "@monteai/types";
import { Spinner } from "../common/Spinner";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { VersionSelector } from "./VersionSelector";
import { PDFHighlightViewer } from "./PDFHighlightViewer";
import { Button } from "../Button";
import { PageLayout } from "../common";
import "globals";
import { ThesisPDFViewerSkeleton } from "./skeletons";
import type { ViewerRole } from "../../pages/ThesisPDFViewer";
import { ThesisStatusTimeline } from "../Thesis/ThesisStatusTime";
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
  onVersionChange: (versionId: string) => void;
  onAddAnnotation: (dto: Omit<CreateAnnotationDto, "thesisVersionId">) => void;
  onResolve: (annotationId: string, dto: ResolveAnnotationDto) => void;
  onDelete: (annotationId: string) => void;
  onGenerateProceedings: () => void;
  onBack?: () => void;
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
  onVersionChange,
  onAddAnnotation,
  onResolve,
  onDelete,
  onGenerateProceedings,
  onBack,
}: ThesisPDFViewerLayoutProps) {
  // currentPage lives here so both sidebar and PDF viewer can read/write it
 const [currentPage, setCurrentPage] = useState(1);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  return (
    <PageLayout>
      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between border-b border-outline-variant bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button
              variant="ghost"
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 !p-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </Button>
          )}
          <div className="h-5 w-px bg-outline-variant" />
          <h1 className="font-sans text-lg font-semibold text-on-surface">
            Thesis Review
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <VersionSelector
            versions={versions}
            activeVersion={activeVersion}
            onVersionChange={(id) => {
              onVersionChange(id);
              setCurrentPage(1); // reset to page 1 on version switch
            }}
          />

          {unresolvedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {unresolvedCount} unresolved
            </span>
          )}

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
        <div className="flex flex-1 overflow-hidden">
          {thesis && (
            <ThesisStatusTimeline
              thesis={thesis}
              role={role}
              isCollapsed={timelineCollapsed}
              onToggle={() => setTimelineCollapsed((p) => !p)}
            />
          )}
          <main className="flex-1 overflow-hidden">
            <PDFHighlightViewer
              fileUrl={fileUrl}
              annotations={annotations}
              isCreating={isCreating}
              canAnnotate={canAnnotate}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onAddAnnotation={onAddAnnotation}
            />
          </main>

          <aside className="w-80 shrink-0 overflow-y-auto border-l border-outline-variant bg-white">
            <AnnotationSidebar
              annotations={annotations}
              unresolvedCount={unresolvedCount}
              resolvedCount={resolvedCount}
              isResolving={isResolving}
              onResolve={onResolve}
              onDelete={onDelete}
              onJumpToPage={setCurrentPage}
            />
          </aside>
        </div>
      )}
    </PageLayout>
  );
}