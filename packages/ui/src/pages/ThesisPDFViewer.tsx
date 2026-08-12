import { useState } from "react";
import { PdfLoader, PdfHighlighter, Highlight, Popup, Tip, NewHighlight } from "react-pdf-highlighter";
import { Spinner } from "../components/common";
interface AnnotationComment {
  id: string;
  content: string;
  highlightedText?: string;
  position: object; // bounding box from react-pdf-highlighter
  pageNumber: number;
  createdBy: string;
  createdAt: string;
}

export default function ThesisPDFViewer({ thesisId, fileUrl }: Props) {
  const [annotations, setAnnotations] = useState<AnnotationComment[]>([]);
  const [pendingComment, setPendingComment] = useState<string>("");

  const addHighlight = (highlight: NewHighlight) => {
    const annotation: AnnotationComment = {
      id: crypto.randomUUID(),
      content: pendingComment,
      highlightedText: highlight.content.text,
      position: highlight.position,
      pageNumber: highlight.position.pageNumber,
      createdBy: "Director",
      createdAt: new Date().toISOString(),
    };
    setAnnotations(prev => [...prev, annotation]);
    // persist to backend
    // saveAnnotation(thesisId, annotation);
  };

  return (
    <div className="flex h-full">
      {/* PDF + highlight layer */}
      <div className="flex-1 relative">
        <PdfLoader url={fileUrl} beforeLoad={<Spinner />}>
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              highlights={annotations}
              onScrollChange={() => {}}
              scrollRef={() => {}}
              onSelectionFinished={(position, content, hideTipAndSelection) => (
                <Tip
                  onOpen={() => {}}
                  onConfirm={(comment) => {
                    addHighlight({ content, position, comment });
                    hideTipAndSelection();
                  }}
                />
              )}
              highlightTransform={(highlight, index, setTip, hideTip, _, __, isScrolledTo) => (
                <Popup
                  popupContent={<CommentPopup comment={highlight.content} />}
                  onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
                  onMouseOut={hideTip}
                  key={index}
                >
                  <Highlight
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                    comment={highlight.comment}
                  />
                </Popup>
              )}
            />
          )}
        </PdfLoader>
      </div>

      {/* Comments sidebar */}
      <AnnotationSidebar
        annotations={annotations}
        onDelete={(id) => setAnnotations(prev => prev.filter(a => a.id !== id))}
        onGenerateProceedings={() => generateProceedings(thesisId)}
      />
    </div>
  );
}