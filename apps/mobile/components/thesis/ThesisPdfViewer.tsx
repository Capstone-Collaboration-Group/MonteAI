// apps/mobile/components/thesis/ThesisPdfViewer.tsx
//
// React Native wrapper around the PDF.js WebView (see pdfViewerHtml.ts). It
// owns the message bridge: it forwards the PDF outline / current page up to
// the screen and exposes imperative scroll-to-page and flash-annotation
// commands through a ref.

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { AnnotationResponseDto } from '@monteai/types';
import { buildPdfViewerHtml } from './pdfViewerHtml';

export interface PdfOutlineItem {
  id: string;
  title: string;
  level: number;
  page: number;
}

export interface ThesisPdfViewerHandle {
  scrollToPage: (page: number) => void;
  flashAnnotation: (annotationId: string) => void;
}

interface ThesisPdfViewerProps {
  fileUrl: string;
  annotations: AnnotationResponseDto[];
  onOutline: (items: PdfOutlineItem[]) => void;
  onPageChange: (page: number) => void;
  onReady?: (pageCount: number) => void;
  onError?: (message: string) => void;
}

// Content injected with `source={{ html }}` runs on an opaque origin, so
// PDF.js's fetch of the (signed) blob URL is cross-origin. Azure Blob Storage
// sends no CORS headers, which surfaces as "Failed to fetch". Loading the HTML
// with the PDF host as its base URL gives the page that host's origin and
// makes the request same-origin — no CORS needed. Data URLs (mock mode) are
// decoded in-page, so they need no base URL.
function pdfBaseUrl(fileUrl: string): string | undefined {
  const match = /^(https?:\/\/[^/]+)\//i.exec(fileUrl);
  return match ? `${match[1]}/` : undefined;
}

export const ThesisPdfViewer = forwardRef<ThesisPdfViewerHandle, ThesisPdfViewerProps>(
  function ThesisPdfViewer(
    { fileUrl, annotations, onOutline, onPageChange, onReady, onError },
    ref,
  ) {
    const webRef = useRef<WebView>(null);
    const readyRef = useRef(false);
    const primary = useThemeColor({}, 'primary');
    const onPrimary = useThemeColor({}, 'onPrimary');

    const html = useMemo(() => buildPdfViewerHtml(fileUrl), [fileUrl]);
    const baseUrl = useMemo(() => pdfBaseUrl(fileUrl), [fileUrl]);

    // Only the fields the viewer needs are bridged over.
    const annotationsJson = useMemo(
      () =>
        JSON.stringify(
          annotations.map((a) => ({
            id: a.id,
            pageNumber: a.pageNumber,
            isResolved: a.isResolved,
            positionJson: a.positionJson,
          })),
        ),
      [annotations],
    );

    const inject = useCallback((js: string) => {
      webRef.current?.injectJavaScript(`${js}; true;`);
    }, []);

    const pushAnnotations = useCallback(() => {
      inject(`window.__viewer && window.__viewer.setAnnotations(${annotationsJson})`);
    }, [annotationsJson, inject]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (page: number) =>
          inject(`window.__viewer && window.__viewer.scrollToPage(${Math.floor(page)})`),
        flashAnnotation: (annotationId: string) =>
          inject(
            `window.__viewer && window.__viewer.flashAnnotation(${JSON.stringify(annotationId)})`,
          ),
      }),
      [inject],
    );

    // Keep the overlays in sync with Firestore once the document is ready.
    useEffect(() => {
      if (!readyRef.current) return;
      pushAnnotations();
    }, [pushAnnotations]);

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        let msg: { type?: string; count?: number; page?: number; items?: PdfOutlineItem[]; message?: string };
        try {
          msg = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'ready':
            readyRef.current = true;
            onReady?.(msg.count ?? 0);
            pushAnnotations();
            break;
          case 'outline':
            onOutline(Array.isArray(msg.items) ? msg.items : []);
            break;
          case 'page':
            onPageChange(typeof msg.page === 'number' ? msg.page : 1);
            break;
          case 'error':
            onError?.(msg.message ?? 'Failed to load the PDF.');
            break;
          default:
            break;
        }
      },
      [onError, onOutline, onPageChange, onReady, pushAnnotations],
    );

    return (
      <View style={s.container}>
        <WebView
          ref={webRef}
          key={fileUrl}
          originWhitelist={['*']}
          source={{ html, baseUrl }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          style={s.webview}
          containerStyle={s.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={[s.loading, { backgroundColor: primary }]}>
              <ActivityIndicator size="large" color={onPrimary} />
              <Text style={[s.loadingText, { color: onPrimary }]}>Loading PDF…</Text>
            </View>
          )}
        />
      </View>
    );
  },
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#52575c' },
  webview: { flex: 1, backgroundColor: '#52575c' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },
});
