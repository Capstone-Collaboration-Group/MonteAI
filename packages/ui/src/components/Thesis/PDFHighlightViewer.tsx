// packages/ui/src/components/Thesis/PDFHighlightViewer.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Document, Page } from "react-pdf";
import type {
  AnnotationResponseDto,
  CreateAnnotationDto,
} from "@monteai/types";
import { MessageSquarePlus } from "lucide-react";
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

interface PageSize {
  width: number;
  height: number;
}

// Structural view of the pdf.js objects we touch, typed locally so
// @monteai/ui keeps no direct pdfjs-dist dependency (the runtime objects
// returned by react-pdf's Document satisfy this shape).
interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getViewport(opts: { scale: number }): PageSize;
  }>;
}

// Border-box allowance for the page card around each PDF page: p-3 padding
// (12px × 2) + 1px border × 2 (Tailwind sets box-sizing: border-box).
const PAGE_FRAME_PX = 26;

// pdf.js init options — defined at module scope so the object identity never
// changes (react-pdf restarts the download when `options` is a new object).
//
// `disableStream` + `disableAutoFetch` switch pdf.js into HTTP range-request
// mode: instead of downloading the whole PDF before anything renders (which
// took ~20s on 100+ page scanned theses), it fetches only the head/xref and
// the chunks needed for the visible window — first page shows in ~1–2s and
// later pages are fetched on demand. If the server doesn't support range
// requests, pdf.js silently falls back to a normal full download.
const PDF_OPTIONS = {
  disableStream: true,
  disableAutoFetch: true,
};

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
  scale: number,
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
      className="absolute z-50 w-64 rounded-xl border border-outline-variant bg-white p-3 shadow-lg"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-semibold text-on-surface">Add Comment</p>
      <textarea
        autoFocus
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write your review comment…"
        rows={3}
        className="w-full resize-none rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (comment.trim()) onConfirm(comment.trim());
          }}
          disabled={!comment.trim() || isCreating}
          className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-white transition-colors hover:bg-on-surface disabled:opacity-50"
        >
          {isCreating ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-outline-variant py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
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
  const pageAnnotations = annotations.filter(
    (a) => a.pageNumber === pageNumber,
  );

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

// ── Loading Indicator ─────────────────────────────────────────────────────────

// Spinner + indeterminate bar. Deliberately shows no percentage: pdf.js byte
// progress never tracks perceived readiness — in range mode it barely moves
// while pages already paint, and in full mode it hits 100% before parsing and
// first render are done.
function LoadingIndicator() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8 text-primary" />
      <div className="w-64 text-center">
        <p className="mb-2 text-xs text-on-surface-variant">Loading…</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-low">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </div>
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
  const [visiblePage, setVisiblePage] = useState<number>(1);
  // Page dimensions at scale 1, indexed by page − 1. Only page 1 is measured
  // up front (thesis pages are uniform); pages near the viewport are refined
  // exactly afterwards. `null` = "not measured yet, use page 1's size".
  const [pageSizes, setPageSizes] = useState<(PageSize | null)[]>([]);
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);
  // The pdf.js document handle, kept in a ref so the size-refinement effect
  // can measure pages without re-creating callbacks on every render.
  const pdfDocRef = useRef<PdfDocumentProxy | null>(null);

  const updateVisiblePage = useCallback(() => {
    const container = viewerScrollRef.current;
    if (!container || numPages === 0) return;

    const pageEls = Array.from(
      container.querySelectorAll<HTMLElement>("[data-page-number]")
    );

    if (pageEls.length === 0) return;

    const middleOfView = container.scrollTop + container.clientHeight / 2;
    let closestPage = 1;
    let closestDistance = Number.MAX_SAFE_INTEGER;

    for (const pageEl of pageEls) {
      const pageNumber = Number(pageEl.dataset.pageNumber ?? 1);
      const pageTop = pageEl.offsetTop;
      const pageMiddle = pageTop + pageEl.offsetHeight / 2;
      const distance = Math.abs(pageMiddle - middleOfView);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNumber;
      }
    }

    setVisiblePage(closestPage);
    if (closestPage !== currentPage) {
      onPageChange(closestPage);
    }
  }, [currentPage, numPages, onPageChange]);

  // Measure only page 1 up front (parse-only — no rasterization): it seeds
  // every placeholder so the viewer can paint immediately. Measuring all N
  // pages here would stall first paint — and in range-request mode it would
  // fan out one network fetch per page for no visible benefit.
  const sizeLoadGenRef = useRef(0);
  const seedPageSize = useCallback(async (pdf: PdfDocumentProxy) => {
    // Each measurement supersedes any still in flight (rapid version
    // switches): a stale resolve must never size the newer document.
    const generation = ++sizeLoadGenRef.current;
    const first = await pdf
      .getPage(1)
      .then((page) => page.getViewport({ scale: 1 }))
      .catch(() => null);
    // A newer file superseded this measurement — discard it.
    if (generation !== sizeLoadGenRef.current) return;
    const size =
      first ??
      // US Letter — matches pdf.js's default when a page cannot be measured.
      { width: 612, height: 792 };
    setPageSizes(
      Array.from({ length: pdf.numPages }, (_, index) =>
        index === 0 ? size : null
      )
    );
  }, []);

  const onDocumentLoadSuccess = useCallback(
    (pdf: PdfDocumentProxy) => {
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setVisiblePage(1);
      // Start the new document at the top — react-pdf swaps files while this
      // callback is the only place we run, and content grows from empty.
      if (viewerScrollRef.current) viewerScrollRef.current.scrollTop = 0;
      if (pdf.numPages > 0) {
        onPageChange(1);
      }
      void seedPageSize(pdf);
    },
    [onPageChange, seedPageSize]
  );

  // Only pages near the viewport are mounted as real react-pdf <Page>s;
  // everything else stays a cheap sized placeholder. This mirrors the mobile
  // WebView viewer's render window (current −1 … current + 3): mounting all
  // N pages at once is what made large theses slow to open. Pages leaving the
  // window unmount, releasing their canvases.
  const renderWindow = useMemo(() => {
    const from = Math.max(1, visiblePage - 1);
    const to = Math.min(numPages, visiblePage + 3);
    const pages = new Set<number>();
    for (let page = from; page <= to; page++) pages.add(page);
    return pages;
  }, [visiblePage, numPages]);

  // Refine pages near the viewport to their exact size (matters only for
  // mixed-size documents — landscape pages etc.). Pages keep page 1's
  // dimensions until they approach the window, so this never blocks paint and
  // never storms the network up front. Runs whenever the window or the size
  // table changes and stops as soon as everything in view is measured.
  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || pageSizes.length === 0) return;
    const pendingPages = [...renderWindow].filter(
      (page) => page >= 1 && page <= pageSizes.length && !pageSizes[page - 1]
    );
    if (pendingPages.length === 0) return;

    let stale = false;
    void Promise.all(
      pendingPages.map((page) =>
        pdf
          .getPage(page)
          .then((p) => p.getViewport({ scale: 1 }))
          .catch(() => null)
      )
    ).then((measured) => {
      // Ignore stale resolutions: another document loaded, or this effect
      // was cleaned up by a newer run.
      if (stale || pdfDocRef.current !== pdf) return;
      setPageSizes((prev) => {
        const next = [...prev];
        pendingPages.forEach((page, i) => {
          const size = measured[i];
          if (size && page - 1 < next.length && !next[page - 1]) {
            next[page - 1] = size;
          }
        });
        return next;
      });
    });
    return () => {
      stale = true;
    };
  }, [renderWindow, pageSizes]);

  useEffect(() => {
    updateVisiblePage();
  }, [scale, updateVisiblePage]);

  // Ctrl + scroll to zoom the PDF.
  // This MUST be a native (non-React) event listener registered with
  // { passive: false }. React's built-in onWheel prop is passive by
  // default, which means event.preventDefault() inside a JSX onWheel
  // handler silently does nothing — the browser's own zoom/scroll still
  // fires alongside it. Attaching the listener manually like this is
  // the only reliable way to actually stop the browser's default
  // behavior and let our custom zoom take over cleanly.
  useEffect(() => {
    const container = viewerScrollRef.current;
    if (!container) return;

    const handleWheelNative = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();

      setScale((prevScale) => {
        const next =
          event.deltaY > 0
            ? Math.max(0.7, prevScale - 0.1)
            : Math.min(2.5, prevScale + 0.1);
        return next;
      });
    };

    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelNative);
  }, []);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!canAnnotate) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim())
      return;

    const pageEl = event.currentTarget;
    if (!pageEl || !pageEl.contains(selection.anchorNode)) return;

    const pageNumber = Number(pageEl.dataset.pageNumber ?? currentPage);
    const rects = getRectsFromSelection(selection, pageEl, scale);
    if (rects.length === 0) return;

    const lastRect = rects[rects.length - 1];
    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = pageEl.parentElement?.getBoundingClientRect() ?? pageRect;

    setPending({
      text: selection.toString().trim(),
      position: { pageNumber, rects },
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
    [pending, onAddAnnotation],
  );

  const handleCancel = useCallback(() => {
    setPending(null);
  }, []);

  // Page 1's measured size — seeds every placeholder until refined.
  const seedSize = pageSizes[0];

  return (
    <div className="relative flex h-full w-full flex-col bg-surface-container-low">
      <div className="flex items-center justify-between border-b border-outline-variant bg-white px-4 py-2">
        <div className="flex items-center gap-3 text-sm text-on-surface-variant">
          <span className="inline-flex items-center justify-center rounded-md border border-outline-variant bg-surface px-2 py-1 font-medium text-on-surface">
            {visiblePage} / {numPages}
          </span>
          <span className="text-on-surface-variant">pages</span>
        </div>

        <div className="flex items-center gap-3">
          {canAnnotate && (
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Select text to annotate
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.7, s - 0.1))}
              className="rounded-md px-2 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              − Zoom
            </button>
            <span className="w-12 text-center text-xs text-outline">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
              className="rounded-md px-2 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              + Zoom
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewerScrollRef}
        className="relative flex flex-1 overflow-auto px-6 py-6"
        onScroll={updateVisiblePage}
      >
        {pending && (
          <AnnotationPopup
            x={pending.popupX}
            y={pending.popupY}
            onConfirm={handleConfirmAnnotation}
            onCancel={handleCancel}
            isCreating={isCreating}
          />
        )}

        <div className="mx-auto flex w-full max-w-[900px] flex-col items-center gap-6">
          <Document
            file={fileUrl}
            options={PDF_OPTIONS}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<LoadingIndicator />}
            error={
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-red-600">
                  Failed to load PDF.
                </p>
                <p className="text-xs text-outline">
                  Check the file URL or your network connection.
                </p>
              </div>
            }
          >
            {pageSizes.length === numPages &&
              seedSize &&
              pageSizes.map((exactSize, index) => {
                const size = exactSize ?? seedSize;
                const pageNumber = index + 1;
                const contentWidth = size.width * scale;
                const contentHeight = size.height * scale;
                const inWindow = renderWindow.has(pageNumber);
                const placeholder = (
                  <div
                    style={{ width: contentWidth, height: contentHeight }}
                    className="flex items-center justify-center rounded bg-surface-container-low text-xs font-medium text-outline"
                  >
                    {pageNumber}
                  </div>
                );

                return (
                  <div
                    key={pageNumber}
                    data-page-number={pageNumber}
                    onMouseUp={handleMouseUp}
                    style={{
                      width: contentWidth + PAGE_FRAME_PX,
                      height: contentHeight + PAGE_FRAME_PX,
                    }}
                    className="relative mb-6 last:mb-0 overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    {inWindow ? (
                      <>
                        <Page
                          pageNumber={pageNumber}
                          scale={scale}
                          className="shadow-none"
                          renderAnnotationLayer
                          renderTextLayer
                          loading={placeholder}
                        />
                        <HighlightOverlay
                          annotations={annotations}
                          pageNumber={pageNumber}
                          scale={scale}
                        />
                      </>
                    ) : (
                      placeholder
                    )}
                  </div>
                );
              })}
          </Document>
        </div>
      </div>

      {isCreating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Spinner className="h-6 w-6 text-primary" />
        </div>
      )}
    </div>
  );
}