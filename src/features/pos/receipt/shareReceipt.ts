import { toPng } from "html-to-image";
import { toast } from "sonner";

/**
 * Capture the [data-print-area] node as a PNG and share/download it.
 * Adds breathing room + soft background around the receipt so the saved
 * image looks polished (not edge-to-edge clipped).
 */
export const shareReceiptImage = async (
    filename = "receipt.png",
    sourceSelector = "[data-print-area]",
) => {
    const node = document.querySelector(sourceSelector) as HTMLElement | null;
    if (!node) {
        toast.error("Nothing to share");
        return;
    }

    const PAD = 28;
    const w = node.offsetWidth;
    const h = node.offsetHeight;

    let blob: Blob | null = null;
    try {
        const dataUrl = await toPng(node, {
            pixelRatio: 2,
            cacheBust: true,
            backgroundColor: "#f1f5f9",
            width: w + PAD * 2,
            height: h + PAD * 2,
            style: {
                margin: `${PAD}px`,
                borderRadius: "20px",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                background: "#ffffff",
            },
        });
        const res = await fetch(dataUrl);
        blob = await res.blob();
    } catch (e) {
        console.error("[shareReceipt] capture failed", e);
        toast.error("Could not generate receipt image");
        return;
    }

    const file = new File([blob], filename, { type: "image/png" });

    const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
            await nav.share({ files: [file], title: "Receipt" });
            return;
        } catch (err) {
            if ((err as Error).name === "AbortError") return;
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Receipt downloaded", {
        description: `Saved as ${filename} in your Downloads folder`,
    });
};
