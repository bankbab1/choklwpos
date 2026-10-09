/**
 * Print the element flagged with [data-print-area] via a hidden iframe.
 * Avoids triggering window.print() on the main document so the rest of
 * the app stays untouched.
 */
export const printReceipt = (sourceSelector = "[data-print-area]") => {
    const node = document.querySelector(sourceSelector) as HTMLElement | null;
    if (!node) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
        document.body.removeChild(iframe);
        return;
    }

    // Pull stylesheets from main doc so Tailwind classes render
    const styles = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style'),
    )
        .map((el) => el.outerHTML)
        .join("\n");

    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt</title>
${styles}
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: 80mm; }
  .receipt-doc { width: 80mm; }
</style>
</head>
<body>
${node.outerHTML}
</body>
</html>`);
    doc.close();

    const cleanup = () => {
        setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 500);
    };

    iframe.onload = () => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } finally {
            cleanup();
        }
    };
};
