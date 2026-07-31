// Draws the CV into the Resume modal with PDF.js, so it looks exactly like the PDF on
// every device (phones can't show a PDF inside a page on their own). It shows whatever
// file the modal's download button points to, and PDF.js is only downloaded the first
// time the modal opens.

// Render at least this many pixels wide so the text stays sharp when zoomed on phones
const MIN_RENDER_WIDTH = 1800;
const MAX_RENDER_WIDTH = 2400;

let renderPromise = null;

export const showResume = (modal) => {
  if (!renderPromise) {
    const viewer = modal.querySelector(".resume-viewer");
    const url = modal.querySelector(".resume-download").getAttribute("href");

    renderPromise = renderResume(viewer, url).catch((error) => {
      console.error("Couldn't render the CV", error);
      viewer.innerHTML =
        '<p class="resume-status">Couldn\'t show the CV here, but you can still download it above.</p>';
      // Try again next time the modal opens
      renderPromise = null;
    });
  }
  return renderPromise;
};

const renderResume = async (viewer, url) => {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.min.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const pdf = await pdfjs.getDocument(url).promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    pages.push(await renderPage(pdfjs, page, viewer.clientWidth));
  }
  viewer.replaceChildren(...pages);
};

const renderPage = async (pdfjs, page, cssWidth) => {
  const pageViewport = page.getViewport({ scale: 1 });
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
  const renderWidth = Math.min(
    Math.max(cssWidth * pixelRatio, MIN_RENDER_WIDTH),
    MAX_RENDER_WIDTH
  );
  const viewport = page.getViewport({
    scale: renderWidth / pageViewport.width,
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;

  const wrapper = document.createElement("div");
  wrapper.className = "resume-page";
  wrapper.append(canvas);

  // The canvas is just a picture, so lay the PDF's links over it to keep them clickable.
  // Positions are percentages so they follow the canvas as it resizes with the modal.
  const annotations = await page.getAnnotations();
  annotations
    .filter((annotation) => annotation.subtype === "Link" && annotation.url)
    .forEach((annotation) => {
      const [left, top, right, bottom] = pdfjs.Util.normalizeRect(
        pageViewport.convertToViewportRectangle(annotation.rect)
      );

      const link = document.createElement("a");
      link.className = "resume-link";
      link.href = annotation.url;
      link.setAttribute("aria-label", annotation.url);
      if (!annotation.url.startsWith("mailto:")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      link.style.left = `${(left / pageViewport.width) * 100}%`;
      link.style.top = `${(top / pageViewport.height) * 100}%`;
      link.style.width = `${((right - left) / pageViewport.width) * 100}%`;
      link.style.height = `${((bottom - top) / pageViewport.height) * 100}%`;
      wrapper.append(link);
    });

  return wrapper;
};
