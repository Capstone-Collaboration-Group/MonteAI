// packages/ui/src/components/Thesis/PDFHighlightViewer.tsx
import { useState, useCallback, useRef } from "react";
import { Document, Page } from "react-pdf";
import type { AnnotationResponseDto, CreateAnnotationDto } from "@monteai/types";
import { ChevronLeft, ChevronRight, MessageSquarePlus } from "lucide-react";
import { Spinner } from "../common/Spinner";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightPosition {
  pageNumber: number;
  rects: HighlightRect[];
}

interface PendingSelection {
  text: string;
  position: HighlightPosition;
  popupX: number;
  popupY: number;
}

interface PDFHighlightViewerProps {
  fileUrl: string;
  annotations: AnnotationResponseDto[];
  isCreating: boolean;
  canAnnotate: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onAddAnnotation: (dto: Omit<CreateAnnotationDto, "thesisVersionId">) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePosition(positionJson: string): HighlightPosition | null {
  try {
    return JSON.parse(positionJson) as HighlightPosition;
  } catch {
    return null;
  }
}

function getRectsFromSelection(
  selection: Selection,
  pageEl: Element,
  scale: number
): HighlightRect[] {
  const pageRect = pageEl.getBoundingClientRect();
  const rects: HighlightRect[] = [];

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const clientRects = Array.from(range.getClientRects());

    for (const r of clientRects) {
      if (r.width < 2 || r.height < 2) continue; // skip ghost rects
      rects.push({
        x: (r.left - pageRect.left) / scale,
        y: (r.top - pageRect.top) / scale,
        width: r.width / scale,
        height: r.height / scale,
      });
    }
  }

  return rects;
}

// ── Annotation Popup ──────────────────────────────────────────────────────────

function AnnotationPopup({
  x,
  y,
  onConfirm,
  onCancel,
  isCreating,
}: {
  x: number;
  y: number;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  isCreating: boolean;
}) {
  const [comment, setComment] = useState("");

  return (
    <div
      className="absolute z-50 w-64 rounded-xl border border-[#EDEAE0] bg-white p-3 shadow-lg"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-semibold text-[#1F2A24]">Add Comment</p>
      <textarea
        autoFocus
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write your review comment…"
        rows={3}
        className="w-full resize-none rounded-lg border border-[#EDEAE0] bg-[#FAF8F1] px-3 py-2 text-xs text-[#1F2A24] placeholder-[#8A9089] focus:outline-none focus:ring-1 focus:ring-[#16342B]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (comment.trim()) onConfirm(comment.trim());
          }}
          disabled={!comment.trim() || isCreating}
          className="flex-1 rounded-lg bg-[#16342B] py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1F2A24] disabled:opacity-50"
        >
          {isCreating ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-[#EDEAE0] py-1.5 text-xs font-medium text-[#4A5750] transition-colors hover:bg-[#F3F1E9]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Highlight Overlay ─────────────────────────────────────────────────────────

function HighlightOverlay({
  annotations,
  pageNumber,
  scale,
}: {
  annotations: AnnotationResponseDto[];
  pageNumber: number;
  scale: number;
}) {
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  return (
    <>
      {pageAnnotations.map((annotation) => {
        const position = parsePosition(annotation.positionJson);
        if (!position) return null;

        return position.rects.map((rect, i) => (
          <div
            key={`${annotation.id}-${i}`}
            className="pointer-events-none absolute"
            style={{
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.width * scale,
              height: rect.height * scale,
              backgroundColor: annotation.isResolved
                ? "rgba(134, 239, 172, 0.35)" // green-300 for resolved
                : "rgba(251, 191, 36, 0.35)", // amber-400 for unresolved
              borderRadius: 2,
            }}
          />
        ));
      })}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PDFHighlightViewer({
  fileUrl,
  annotations,
  isCreating,
  canAnnotate,
  currentPage,
  onPageChange,
  onAddAnnotation,
}: PDFHighlightViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    if (!canAnnotate) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const pageEl = pageRef.current;
    if (!pageEl) return;

    // Ensure selection is inside the PDF page
    if (!pageEl.contains(selection.anchorNode)) return;

    const rects = getRectsFromSelection(selection, pageEl, scale);
    if (rects.length === 0) return;

    // Position popup near the end of the selection
    const lastRect = rects[rects.length - 1];
    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = pageEl.parentElement!.getBoundingClientRect();

    setPending({
      text: selection.toString().trim(),
      position: { pageNumber: currentPage, rects },
      popupX: pageRect.left - containerRect.left,
      popupY:
        pageRect.top -
        containerRect.top +
        (lastRect.y + lastRect.height) * scale +
        8,
    });

    selection.removeAllRanges();
  }, [canAnnotate, currentPage, scale]);

  const handleConfirmAnnotation = useCallback(
    (comment: string) => {
      if (!pending) return;
      onAddAnnotation({
        comment,
        highlightedText: pending.text,
        positionJson: JSON.stringify(pending.position),
        pageNumber: pending.position.pageNumber,
      });
      setPending(null);
    },
    [pending, onAddAnnotation]
  );

  const handleCancel = useCallback(() => {
    setPending(null);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col bg-[#F3F1E9]">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between border-b border-[#EDEAE0] bg-white px-4 py-2">
        {/* Page nav */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded-md p-1.5 text-[#4A5750] transition-colors hover:bg-[#F3F1E9] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-[#4A5750]">
            <span className="font-semibold text-[#1F2A24]">{currentPage}</span>
            {" / "}
            {numPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="rounded-md p-1.5 text-[#4A5750] transition-colors hover:bg-[#F3F1E9] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Annotate hint */}
          {canAnnotate && (
            <span className="flex items-center gap-1.5 text-xs text-[#8A9089]">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Select text to annotate
            </span>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              className="rounded-md px-2 py-1 text-xs font-medium text-[#4A5750] transition-colors hover:bg-[#F3F1E9]"
            >
              − Zoom
            </button>
            <span className="w-12 text-center text-xs text-[#8A9089]">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              className="rounded-md px-2 py-1 text-xs font-medium text-[#4A5750] transition-colors hover:bg-[#F3F1E9]"
            >
              + Zoom
            </button>
          </div>
        </div>
      </div>

      {/* ── PDF + overlays ── */}
      <div
        className="relative flex flex-1 justify-center overflow-auto px-6 py-6"
        onMouseUp={handleMouseUp}
      >
        {/* Annotation popup */}
        {pending && (
          <AnnotationPopup
            x={pending.popupX}
            y={pending.popupY}
            onConfirm={handleConfirmAnnotation}
            onCancel={handleCancel}
            isCreating={isCreating}
          />
        )}

        {/* PDF page wrapper — highlights are positioned relative to this */}
        <div ref={pageRef} className="relative">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex h-64 items-center justify-center">
                <Spinner className="h-8 w-8 text-[#16342B]" />
              </div>
            }
            error={
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-red-600">Failed to load PDF.</p>
                <p className="text-xs text-[#8A9089]">
                  Check the file URL or your network connection.
                </p>
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              className="shadow-lg"
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>

          {/* Highlight overlays sit on top of the page */}
          <HighlightOverlay
            annotations={annotations}
            pageNumber={currentPage}
            scale={scale}
          />
        </div>
      </div>

      {/* Creating overlay */}
      {isCreating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Spinner className="h-6 w-6 text-[#16342B]" />
        </div>
      )}
    </div>
  );
}