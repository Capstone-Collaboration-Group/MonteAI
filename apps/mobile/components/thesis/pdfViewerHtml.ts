// apps/mobile/components/thesis/pdfViewerHtml.ts
//
// The HTML document rendered inside the mobile WebView. PDF.js (pinned to the
// version the rest of the repo uses) renders every page as a continuously
// scrollable, lazily-drawn canvas, extracts the PDF's bookmark outline for the
// sections dropdown, and draws live annotation highlight overlays.
//
// Bridge
// ------
// WebView -> RN (window.ReactNativeWebView.postMessage, JSON string):
//   { type: 'ready',  count }          document + first window rendered
//   { type: 'pages',  count }          page count
//   { type: 'outline', items }         flattened bookmark outline
//   { type: 'page',   page }           page currently in view
//   { type: 'error',  message }        loading/rendering failure
//
// RN -> WebView (webRef.injectJavaScript):
//   window.__viewer.setAnnotations([...])
//   window.__viewer.scrollToPage(n)
//   window.__viewer.flashAnnotation(id)

const PDFJS_VERSION = "4.4.168";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

export function buildPdfViewerHtml(pdfUrl: string): string {
  const safeUrl = JSON.stringify(pdfUrl);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #52575c; height: 100%; }
  #scroll {
    position: absolute; top: 0; right: 0; bottom: 0; left: 0;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    padding: 8px 0 56px 0;
  }
  #pages { display: block; }
  .page-wrap {
    position: relative; margin: 8px auto; background: #ffffff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.45); overflow: hidden;
  }
  .page-canvas { display: block; }
  .ph {
    position: absolute; top: 0; right: 0; bottom: 0; left: 0;
    display: flex; align-items: center; justify-content: center;
    color: #c3c7cb; font: 600 22px -apple-system, Roboto, sans-serif;
  }
  .hl {
    position: absolute; border-radius: 2px; pointer-events: none;
    transition: opacity .2s ease;
  }
  .hl.unresolved { background: rgba(251,191,36,0.35); border-bottom: 1.5px solid rgba(217,119,6,0.9); }
  .hl.resolved { background: rgba(134,239,172,0.35); border-bottom: 1.5px solid rgba(21,128,61,0.85); }
  .hl.flash { animation: hlflash 1.4s ease 0s 2; }
  @keyframes hlflash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; background: rgba(59,130,246,0.55); }
  }
  #loading, #error {
    position: absolute; top: 0; right: 0; bottom: 0; left: 0;
    display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 24px;
  }
  #loading { color: #e5e7eb; font: 500 15px -apple-system, Roboto, sans-serif; }
  #error { color: #fecaca; font: 500 14px -apple-system, Roboto, sans-serif; display: none; }
</style>
</head>
<body>
  <div id="scroll"><div id="pages"></div></div>
  <div id="loading">Loading PDF&hellip;</div>
  <div id="error"></div>
  <script>
    window.__viewerReady = false;
    setTimeout(function () {
      if (!window.__viewerReady) {
        var l = document.getElementById('loading');
        if (l) { l.textContent = 'Still loading the PDF engine. Check your connection.'; }
      }
    }, 15000);
  </script>
  <script type="module">
    import * as pdfjsLib from '${PDFJS_BASE}/pdf.min.mjs';
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_BASE}/pdf.worker.min.mjs';

    var PDF_URL = ${safeUrl};

    function post(msg) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
    }

    var scrollEl = document.getElementById('scroll');
    var pagesEl = document.getElementById('pages');

    var pdfDoc = null;
    var numPages = 0;
    var scale = 1;
    var pageH = 0;
    var wrappers = [];
    var pageObjs = {};
    var rendered = {};
    var rendering = {};
    var annotations = [];
    var lastPage = 0;

    function showError(message) {
      var el = document.getElementById('error');
      el.textContent = message;
      el.style.display = 'flex';
      var l = document.getElementById('loading');
      if (l) l.style.display = 'none';
      post({ type: 'error', message: message });
    }

    function resolveDestPage(dest) {
      return new Promise(function (resolve) {
        Promise.resolve()
          .then(function () {
            if (typeof dest === 'string') return pdfDoc.getDestination(dest);
            return dest;
          })
          .then(function (explicit) {
            if (explicit && explicit.length && explicit[0] != null) {
              return pdfDoc.getPageIndex(explicit[0]).then(function (idx) { return idx + 1; });
            }
            return null;
          })
          .then(function (page) { resolve(page); })
          .catch(function () { resolve(null); });
      });
    }

    function loadOutline() {
      var items = [];
      return Promise.resolve()
        .then(function () { return pdfDoc.getOutline(); })
        .catch(function () { return null; })
        .then(function (outline) {
          if (!outline || !outline.length) {
            post({ type: 'outline', items: [] });
            return;
          }
          function walk(nodes, level) {
            var chain = Promise.resolve();
            nodes.forEach(function (node) {
              chain = chain.then(function () {
                return resolveDestPage(node.dest).then(function (page) {
                  items.push({
                    id: 'o' + items.length,
                    title: node.title || 'Untitled',
                    level: level,
                    page: page || 1,
                  });
                  if (node.items && node.items.length) return walk(node.items, level + 1);
                  return null;
                });
              });
            });
            return chain;
          }
          return walk(outline, 0).then(function () {
            post({ type: 'outline', items: items });
          });
        });
    }

    function renderPage(n) {
      if (rendered[n] || rendering[n] || !pdfDoc) return;
      rendering[n] = true;
      var wrap = wrappers[n - 1];
      Promise.resolve()
        .then(function () {
          if (pageObjs[n]) return pageObjs[n];
          return pdfDoc.getPage(n).then(function (p) { pageObjs[n] = p; return p; });
        })
        .then(function (page) {
          var viewport = page.getViewport({ scale: scale });
          var canvas = wrap.querySelector('canvas');
          if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'page-canvas';
            wrap.appendChild(canvas);
          }
          var ratio = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          canvas.style.width = Math.floor(viewport.width) + 'px';
          canvas.style.height = Math.floor(viewport.height) + 'px';
          var ctx = canvas.getContext('2d');
          return page.render({
            canvasContext: ctx,
            viewport: viewport,
            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
          }).promise;
        })
        .then(function () {
          rendered[n] = true;
          var ph = wrap.querySelector('.ph');
          if (ph) ph.style.display = 'none';
        })
        .catch(function () { /* ignore individual page failures */ })
        .then(function () { delete rendering[n]; });
    }

    function clearPage(n) {
      var wrap = wrappers[n - 1];
      if (!wrap) return;
      var c = wrap.querySelector('canvas');
      if (c) { c.width = 0; c.height = 0; c.remove(); }
      var ph = wrap.querySelector('.ph');
      if (ph) ph.style.display = 'flex';
      delete rendered[n];
      delete pageObjs[n];
    }

    function setWindow(current) {
      var from = Math.max(1, current - 1);
      var to = Math.min(numPages, current + 3);
      Object.keys(rendered).forEach(function (key) {
        var n = parseInt(key, 10);
        if (n < from || n > to) clearPage(n);
      });
      for (var n = from; n <= to; n++) renderPage(n);
    }

    function currentPageFromScroll() {
      var probe = scrollEl.scrollTop + 60;
      var best = 1;
      var bestDist = Infinity;
      for (var i = 0; i < wrappers.length; i++) {
        var w = wrappers[i];
        if (probe >= w.offsetTop && probe < w.offsetTop + w.offsetHeight) return i + 1;
        var dist = Math.abs(w.offsetTop - probe);
        if (dist < bestDist) { bestDist = dist; best = i + 1; }
      }
      return best;
    }

    var ticking = false;
    scrollEl.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var p = currentPageFromScroll();
        if (p !== lastPage) {
          lastPage = p;
          post({ type: 'page', page: p });
          setWindow(p);
        }
      });
    }, { passive: true });

    function scrollToPage(page) {
      var n = Math.max(1, Math.min(numPages, Math.floor(page) || 1));
      var w = wrappers[n - 1];
      if (!w) return;
      scrollEl.scrollTo({ top: w.offsetTop, behavior: 'smooth' });
    }

    function normalizeAnnotation(a) {
      var rects = [];
      try {
        var parsed = JSON.parse(a.positionJson || '{}');
        if (parsed && Array.isArray(parsed.rects)) {
          rects = parsed.rects.map(function (r) {
            if (!r) return null;
            if (typeof r.x === 'number') return { x: r.x, y: r.y, width: r.width, height: r.height };
            return { x: r.x1 || 0, y: r.y1 || 0, width: r.width || 0, height: r.height || 0 };
          }).filter(Boolean);
        }
      } catch (e) { rects = []; }
      return {
        id: a.id,
        pageNumber: a.pageNumber || 1,
        isResolved: !!a.isResolved,
        rects: rects,
      };
    }

    function clearAnnotations() {
      var nodes = pagesEl.querySelectorAll('.hl');
      for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    }

    function redrawAnnotations() {
      clearAnnotations();
      if (!wrappers.length) return;
      annotations.forEach(function (a) {
        var wrap = wrappers[(a.pageNumber | 0) - 1];
        if (!wrap) return;
        a.rects.forEach(function (rect) {
          var el = document.createElement('div');
          el.className = 'hl ' + (a.isResolved ? 'resolved' : 'unresolved');
          el.setAttribute('data-id', a.id);
          el.style.left = (rect.x * scale) + 'px';
          el.style.top = (rect.y * scale) + 'px';
          el.style.width = (rect.width * scale) + 'px';
          el.style.height = (rect.height * scale) + 'px';
          wrap.appendChild(el);
        });
      });
    }

    function setAnnotations(list) {
      annotations = (list || []).map(normalizeAnnotation);
      redrawAnnotations();
    }

    function flashAnnotation(id) {
      var els = pagesEl.querySelectorAll('.hl[data-id="' + id + '"]');
      if (!els.length) return;
      var el = els[0];
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      var wrap = el.closest ? el.closest('.page-wrap') : null;
      if (wrap) scrollEl.scrollTo({ top: wrap.offsetTop, behavior: 'smooth' });
    }

    window.__viewer = {
      setAnnotations: setAnnotations,
      scrollToPage: scrollToPage,
      flashAnnotation: flashAnnotation,
    };

    function pdfSource() {
      if (typeof PDF_URL === 'string' && PDF_URL.indexOf('data:application/pdf;base64,') === 0) {
        var b64 = PDF_URL.slice('data:application/pdf;base64,'.length);
        var raw = atob(b64);
        var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return { data: arr };
      }
      return { url: PDF_URL };
    }

    function boot() {
      var task = pdfjsLib.getDocument(pdfSource());
      task.promise
        .then(function (doc) {
          pdfDoc = doc;
          numPages = doc.numPages;
          return pdfDoc.getPage(1);
        })
        .then(function (first) {
          var baseViewport = first.getViewport({ scale: 1 });
          var available = scrollEl.clientWidth || window.innerWidth;
          scale = available / baseViewport.width;
          pageH = Math.round(baseViewport.height * scale);

          for (var i = 1; i <= numPages; i++) {
            var wrap = document.createElement('div');
            wrap.className = 'page-wrap';
            wrap.setAttribute('data-page', String(i));
            wrap.style.width = available + 'px';
            wrap.style.height = pageH + 'px';
            var ph = document.createElement('div');
            ph.className = 'ph';
            ph.textContent = String(i);
            wrap.appendChild(ph);
            pagesEl.appendChild(wrap);
            wrappers.push(wrap);
          }

          var loading = document.getElementById('loading');
          if (loading) loading.style.display = 'none';

          return loadOutline();
        })
        .then(function () {
          redrawAnnotations();
          post({ type: 'pages', count: numPages });
          setWindow(1);
          lastPage = 1;
          post({ type: 'page', page: 1 });
          window.__viewerReady = true;
          post({ type: 'ready', count: numPages });
        })
        .catch(function (e) {
          showError('Unable to load the PDF. ' + (e && e.message ? e.message : ''));
        });
    }

    boot();
  </script>
</body>
</html>`;
}
