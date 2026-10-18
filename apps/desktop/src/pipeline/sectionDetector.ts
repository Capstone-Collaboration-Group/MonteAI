// apps/desktop/src/pipeline/sectionDetector.ts
//
// Pre-flight heading detection for the approve/reindex flow. Mirrors the
// server's ThesisSectionFilter (server/Services/Theses/ThesisSectionFilter.cs):
// a document "has headings" when it shows CHAPTER n lines, or — when it has
// none — recognized unnumbered section titles (INTRODUCTION, METHODOLOGY, …
// including the always-boundary back matter like BIBLIOGRAPHY).
//
// This detector only decides whether the renderer must ask the admin to
// confirm metadata-only indexing BEFORE anything is sent. The server re-runs
// the authoritative section filter on ingest either way; if it disagrees, the
// response's "MetadataOnly" status is what the UI reports.

const CHAPTER_HEADING =
  /^[ \t]*(?:CHAPTER|Chapter)[ \t]+(?:[0-9]{1,2}|[IVXLCivxlc]{1,6}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b/m;

// Same title set the server treats as boundaries in fallback mode: kept
// sections (INTRODUCTION, METHODOLOGY, RESULTS AND DISCUSSION, CONCLUSION…)
// and dropped ones (REVIEW OF RELATED LITERATURE, BIBLIOGRAPHY, ABSTRACT…).
// Both mean "structure detected" — what gets KEPT is decided server-side.
const KNOWN_SECTION_TITLES =
  /^[ \t]*(?:INTRODUCTION|THE PROBLEM AND ITS BACKGROUND|REVIEW OF RELATED LITERATURE|LITERATURE REVIEW|METHODOLOGY|METHODOLOGICAL APPROACH|RESULTS AND DISCUSSION|SUMMARY,? CONCLUSIONS? AND RECOMMENDATIONS?|CONCLUSIONS?|SUMMARY AND CONCLUSIONS?|BIBLIOGRAPHY|REFERENCES|APPENDI[XC][A-Z ]*|ACKNOWLEDGE?MENTS?|ABSTRACT|CURRICULUM VITAE|VITA|LIST OF (?:TABLES|FIGURES|SYMBOLS))[ \t.:]*$/mi;

/**
 * True when the extracted PDF text shows recognizable chapter/section
 * structure. False → full-text indexing would be meaningless, so the caller
 * should confirm metadata-only indexing with the user first.
 */
export function detectChapterHeadings(text: string): boolean {
  if (!text || !text.trim()) return false;
  if (CHAPTER_HEADING.test(text)) return true;
  return KNOWN_SECTION_TITLES.test(text);
}
