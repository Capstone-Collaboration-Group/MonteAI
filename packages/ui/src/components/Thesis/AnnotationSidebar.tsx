// packages/ui/src/components/Thesis/AnnotationSidebar.tsx
import { useState } from "react";
import {
  Trash2,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import type {
  AnnotationResponseDto,
  ResolveAnnotationDto,
} from "@monteai/types";
import { Button } from "../Button";
interface AnnotationSidebarProps {
  annotations: AnnotationResponseDto[];
  unresolvedCount: number;
  resolvedCount: number;
  isResolving: boolean;
  onResolve: (annotationId: string, dto: ResolveAnnotationDto) => void;
  onDelete: (annotationId: string) => void;
  onJumpToPage: (page: number) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function AnnotationCard({
  annotation,
  isResolving,
  onResolve,
  onDelete,
  onJumpToPage,
}: {
  annotation: AnnotationResponseDto;
  isResolving: boolean;
  onResolve: (annotationId: string, dto: ResolveAnnotationDto) => void;
  onDelete: (annotationId: string) => void;
  onJumpToPage: (page: number) => void;
}) {
  const [resolverNote, setResolverNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const handleResolveToggle = () => {
    if (annotation.isResolved) {
      onResolve(annotation.id, { isResolved: false });
    } else {
      setShowNoteInput((prev) => !prev);
    }
  };

  const handleConfirmResolve = () => {
    onResolve(annotation.id, {
      isResolved: true,
      resolverNote: resolverNote.trim() || undefined,
    });
    setShowNoteInput(false);
    setResolverNote("");
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        annotation.isResolved
          ? "border-outline-variant bg-surface opacity-70"
          : "border-outline-variant bg-white"
      }`}
    >
      {/* Page tag + date */}
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          onClick={() => onJumpToPage(annotation.pageNumber)}
          className="flex items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-outline-variant hover:text-primary"
        >
          Page {annotation.pageNumber}
          <ArrowRight className="h-3 w-3" />
        </Button>
        <span className="text-xs text-outline">
          {formatDate(annotation.createdAt)}
        </span>
      </div>

      {/* Highlighted text */}
      {annotation.highlightedText && (
        <blockquote className="mb-2 border-l-2 border-secondary pl-3 text-xs italic text-on-surface-variant">
          "{annotation.highlightedText}"
        </blockquote>
      )}

      {/* Comment */}
      <p className="mb-3 text-sm text-on-surface">{annotation.comment}</p>

      {/* Resolver note */}
      {annotation.isResolved && annotation.resolverNote && (
        <p className="mb-3 text-xs text-outline">
          <span className="font-medium">Note:</span> {annotation.resolverNote}
        </p>
      )}

      {/* Resolve note input */}
      {showNoteInput && (
        <div className="mb-3">
          <textarea
            value={resolverNote}
            onChange={(e) => setResolverNote(e.target.value)}
            placeholder="Optional note on how this was addressed…"
            rows={2}
            className="w-full resize-none rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleConfirmResolve}
            disabled={isResolving}
            className="mt-1.5 w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-white transition-colors hover:bg-on-surface disabled:opacity-60"
          >
            {isResolving ? "Saving…" : "Mark as Resolved"}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleResolveToggle}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            annotation.isResolved
              ? "text-outline hover:text-primary"
              : "text-green-700 hover:text-green-800"
          }`}
        >
          {annotation.isResolved ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" /> Resolved
            </>
          ) : (
            <>
              <Circle className="h-3.5 w-3.5" /> Mark resolved
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDelete(annotation.id)}
          aria-label="Delete annotation"
          className="rounded-md p-1 text-outline transition-colors hover:bg-error-container hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AnnotationSidebar({
  annotations,
  unresolvedCount,
  resolvedCount,
  isResolving,
  onResolve,
  onDelete,
  onJumpToPage,
}: AnnotationSidebarProps) {
  const [showResolved, setShowResolved] = useState(false);

  const unresolved = annotations.filter((a) => !a.isResolved);
  const resolved = annotations.filter((a) => a.isResolved);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-outline-variant px-5 py-4">
        <h2 className="font-serif text-base font-semibold text-on-surface">
          Review Comments
        </h2>
        <div className="mt-1 flex gap-3 text-xs text-outline">
          <span>
            <span className="font-semibold text-amber-600">
              {unresolvedCount}
            </span>{" "}
            unresolved
          </span>
          <span>
            <span className="font-semibold text-green-700">
              {resolvedCount}
            </span>{" "}
            resolved
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-on-surface-variant">
              No comments yet
            </p>
            <p className="mt-1 text-xs text-outline">
              Select text in the PDF to add a comment.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unresolved.map((a) => (
              <AnnotationCard
                key={a.id}
                annotation={a}
                isResolving={isResolving}
                onResolve={onResolve}
                onDelete={onDelete}
                onJumpToPage={onJumpToPage}
              />
            ))}

            {resolved.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowResolved((p) => !p)}
                  className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wide text-outline transition-colors hover:text-primary"
                >
                  Resolved ({resolved.length})
                  {showResolved ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                {showResolved && (
                  <div className="flex flex-col gap-3">
                    {resolved.map((a) => (
                      <AnnotationCard
                        key={a.id}
                        annotation={a}
                        isResolving={isResolving}
                        onResolve={onResolve}
                        onDelete={onDelete}
                        onJumpToPage={onJumpToPage}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
