import { apiFile, type Query } from "@/lib/api/client";

/**
 * Open a PDF from the API in a new tab. The tab is opened synchronously (inside the click) so pop-up
 * blockers allow it, then pointed at the downloaded file.
 */
export async function openPdf(path: string, query?: Query): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const { blob, filename } = await apiFile(path, query);
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      saveBlob(blob, filename ?? "document.pdf");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Download a file from the API (exports, templates). */
export async function downloadFile(path: string, query?: Query, fallbackName = "download"): Promise<void> {
  const { blob, filename } = await apiFile(path, query);
  saveBlob(blob, filename ?? fallbackName);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
