// apps/mobile/app/thesis/[id].tsx
//
// Mobile thesis reader. A continuously scrollable PDF (PDF.js in a WebView)
// with two dropdowns:
//   • Sections    — the PDF's table-of-contents/bookmarks, tap to scroll.
//   • Annotations — live Firestore review comments, tap to jump + flash.
//
// Reachable from the Library tab (tap a thesis card).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useThesisAnnotations } from '@/hooks/useThesisAnnotations';
import { getAnnotationService } from '@/lib/annotationService';
import { thesisService } from '@/lib/thesisService';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { ThesisPdfViewer } from '@/components/thesis/ThesisPdfViewer';
import type { PdfOutlineItem, ThesisPdfViewerHandle } from '@/components/thesis/ThesisPdfViewer';
import { SectionsSheet } from '@/components/thesis/SectionsSheet';
import { AnnotationsSheet } from '@/components/thesis/AnnotationsSheet';
import { BottomSheet } from '@/components/thesis/BottomSheet';
import type {
  AnnotationResponseDto,
  ThesisResponseDto,
  ThesisVersion,
} from '@monteai/types';

export default function ThesisViewerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Block screenshots/screen recording while this sensitive document is open.
  // Android: FLAG_SECURE (also blanks the recent-apps preview). iOS 13+:
  // screenshots and recordings of the secured content are prevented. Capture
  // is automatically re-allowed when the screen unmounts.
  usePreventScreenCapture('thesis-viewer');

  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surface');
  const outline = useThemeColor({}, 'outlineVariant');

  const viewerRef = useRef<ThesisPdfViewerHandle>(null);
  const annotationService = useMemo(() => getAnnotationService(), []);

  const [thesis, setThesis] = useState<ThesisResponseDto | null>(null);
  const [versions, setVersions] = useState<ThesisVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [outlineItems, setOutlineItems] = useState<PdfOutlineItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // ── Load thesis + its versions ──────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [t, v] = await Promise.all([
          thesisService.getThesis(id),
          thesisService.getVersions(id),
        ]);
        if (!active) return;
        const list = Array.isArray(v) ? v : [];
        setThesis(t ?? null);
        setVersions(list);
        const latest = list.length > 0 ? list[list.length - 1] : null;
        setSelectedVersionId(latest ? latest.id : null);
        if (!latest) setError('This thesis has no uploaded versions yet.');
      } catch {
        if (active) setError('Unable to load this thesis.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const activeVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  // ── Resolve the signed file URL for the active version ──────────────────────
  useEffect(() => {
    if (!selectedVersionId) return;
    let active = true;
    setFileUrl(null);
    setFileLoading(true);
    setOutlineItems([]);
    setCurrentPage(1);
    setPageCount(0);

    (async () => {
      try {
        const res = await thesisService.getVersionFile(selectedVersionId);
        if (active) setFileUrl(res?.url ?? null);
      } catch {
        if (active) setFileUrl(null);
      } finally {
        if (active) setFileLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedVersionId]);

  // ── Live annotations ────────────────────────────────────────────────────────
  const { annotations, unresolvedCount } = useThesisAnnotations(
    annotationService,
    id ?? '',
    selectedVersionId ?? '',
  );

  const handleOutline = useCallback((items: PdfOutlineItem[]) => {
    setOutlineItems(items);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleReady = useCallback((count: number) => {
    setPageCount(count);
  }, []);

  const handleViewerError = useCallback((message: string) => {
    setError(message);
  }, []);

  const goToSection = useCallback((item: PdfOutlineItem) => {
    setSectionsOpen(false);
    requestAnimationFrame(() => viewerRef.current?.scrollToPage(item.page));
  }, []);

  const goToAnnotation = useCallback((annotation: AnnotationResponseDto) => {
    setAnnotationsOpen(false);
    requestAnimationFrame(() => viewerRef.current?.flashAnnotation(annotation.id));
  }, []);

  return (
    <View style={[s.root, { backgroundColor: background }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: primary }}>
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={s.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color={onPrimary} />
          </Pressable>
          <Text numberOfLines={1} style={[s.headerTitle, { color: onPrimary }]}>
            {thesis?.title ?? 'Thesis'}
          </Text>
          <Pressable
            onPress={() => versions.length > 1 && setVersionsOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Select version"
            style={s.headerBtn}>
            <Text style={[s.versionChip, { color: onPrimary }]}>
              v{activeVersion?.versionNumber ?? 1}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Toolbar */}
      <View style={[s.toolbar, { backgroundColor: surface, borderBottomColor: outline }]}>
        <Pressable
          onPress={() => setSectionsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open sections"
          style={({ pressed }) => [s.toolBtn, { borderColor: outline }, pressed && s.pressed]}>
          <MaterialIcons name="toc" size={18} color={primary} />
          <Text style={[s.toolText, { color: heading }]}>Sections</Text>
          {outlineItems.length > 0 ? (
            <Text style={[s.toolCount, { color: body }]}>{outlineItems.length}</Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => setAnnotationsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open annotations"
          style={({ pressed }) => [s.toolBtn, { borderColor: outline }, pressed && s.pressed]}>
          <MaterialIcons name="comment" size={18} color={primary} />
          <Text style={[s.toolText, { color: heading }]}>Annotations</Text>
          {unresolvedCount > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unresolvedCount}</Text>
            </View>
          ) : (
            <Text style={[s.toolCount, { color: body }]}>{annotations.length}</Text>
          )}
        </Pressable>

        <View style={s.spacer} />

        <Text style={[s.pageIndicator, { color: body }]}>
          {currentPage}
          {pageCount > 0 ? ` / ${pageCount}` : ''}
        </Text>
      </View>

      {/* Viewer */}
      <View style={s.viewerArea}>
        {fileUrl ? (
          <ThesisPdfViewer
            ref={viewerRef}
            fileUrl={fileUrl}
            annotations={annotations}
            onOutline={handleOutline}
            onPageChange={handlePageChange}
            onReady={handleReady}
            onError={handleViewerError}
          />
        ) : (
          <View style={s.center}>
            {loading || fileLoading ? (
              <ActivityIndicator size="large" color={primary} />
            ) : (
              <>
                <MaterialIcons name="description" size={40} color={outline} />
                <Text style={[s.placeholder, { color: body }]}>
                  {error ?? 'No PDF available for this thesis.'}
                </Text>
              </>
            )}
          </View>
        )}

        {error && fileUrl ? (
          <View style={[s.errorBanner, { backgroundColor: '#fee2e2' }]}>
            <MaterialIcons name="error-outline" size={16} color="#b91c1c" />
            <Text style={s.errorText} numberOfLines={2}>
              {error}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Dropdowns */}
      <SectionsSheet
        visible={sectionsOpen}
        items={outlineItems}
        currentPage={currentPage}
        onClose={() => setSectionsOpen(false)}
        onSelect={goToSection}
      />

      <AnnotationsSheet
        visible={annotationsOpen}
        annotations={annotations}
        onClose={() => setAnnotationsOpen(false)}
        onSelect={goToAnnotation}
      />

      <BottomSheet
        visible={versionsOpen}
        title="Version history"
        subtitle={`${versions.length} version${versions.length === 1 ? '' : 's'}`}
        onClose={() => setVersionsOpen(false)}>
        <View style={s.versionList}>
          {[...versions].reverse().map((v) => {
            const active = v.id === selectedVersionId;
            return (
              <Pressable
                key={v.id}
                onPress={() => {
                  setSelectedVersionId(v.id);
                  setVersionsOpen(false);
                }}
                style={({ pressed }) => [
                  s.versionRow,
                  { borderColor: outline },
                  active && { borderColor: primary },
                  pressed && s.pressed,
                ]}>
                <View style={s.versionRowText}>
                  <Text style={[s.versionTitle, { color: active ? primary : heading }]}>
                    Version {v.versionNumber}
                  </Text>
                  <Text style={[s.versionMeta, { color: body }]} numberOfLines={1}>
                    {new Date(v.uploadedAt).toLocaleDateString()}
                    {v.changeNote ? ` · ${v.changeNote}` : ''}
                  </Text>
                </View>
                {active ? <MaterialIcons name="check" size={18} color={primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerBtn: { padding: Spacing.xs, minWidth: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.md, fontWeight: '700' },
  versionChip: { fontSize: FontSize.sm, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  toolText: { fontSize: FontSize.sm, fontWeight: '600' },
  toolCount: { fontSize: FontSize.xs, fontWeight: '600' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  spacer: { flex: 1 },
  pageIndicator: { fontSize: FontSize.sm, fontWeight: '600' },
  viewerArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  placeholder: { fontSize: FontSize.sm, textAlign: 'center' },
  errorBanner: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: { flex: 1, color: '#b91c1c', fontSize: FontSize.xs, fontWeight: '500' },
  versionList: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  versionRowText: { flex: 1 },
  versionTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  versionMeta: { fontSize: FontSize.xs, marginTop: 2 },
  pressed: { opacity: 0.85 },
});
