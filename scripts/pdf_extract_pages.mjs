import { readFile } from "node:fs/promises";

// pdfjs-dist (v5+) on Node < 22 may require Promise.withResolvers.
if (typeof Promise.withResolvers !== "function") {
  // eslint-disable-next-line no-undef
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

function cleanPageText(raw) {
  if (!raw) return "";
  let t = String(raw);
  t = t.replace(/\r\n?/g, "\n");
  // de-hyphenate line breaks: "exam-\nple" -> "example"
  t = t.replace(/([A-Za-z0-9])-\n([A-Za-z0-9])/g, "$1$2");
  // trim each line & drop obvious page numbers
  const lines = t
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^(page\s*)?\d+$/i.test(l));
  t = lines.join("\n");
  // collapse excessive whitespace
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

async function main() {
  const [pdfPath] = process.argv.slice(2);
  if (!pdfPath) {
    console.error("Usage: node scripts/pdf_extract_pages.mjs <pdfPath>");
    process.exit(2);
  }

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buf = await readFile(pdfPath);
  const uint8 = new Uint8Array(buf);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    disableWorker: true,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let lastY;
    let out = "";
    for (const item of textContent.items || []) {
      const str = item?.str ?? "";
      const y = item?.transform?.[5];
      if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 2) {
        out += "\n";
      } else if (out.length > 0) {
        out += " ";
      }
      out += str;
      lastY = y;
    }

    pages.push({
      slide_number: pageNum,
      text: cleanPageText(out),
    });
  }

  try {
    await pdf.destroy();
  } catch {
    // ignore
  }

  process.stdout.write(
    JSON.stringify({ numPages: pdf.numPages, pages }, null, 0)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


