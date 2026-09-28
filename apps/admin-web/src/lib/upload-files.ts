// Shared multi-file upload flow for order/application attachments.
// Files are sent one by one through the existing single-file endpoints, so each file
// keeps its own validation/analysis and a failure never affects already saved files.

export type UploadFailure = { name: string; message: string };
export type UploadResult = { uploaded: File[]; failed: UploadFailure[] };

/** Identity of a picked file: the same file picked twice is ignored, same-named files are kept. */
export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Append newly picked files to an existing selection without dropping earlier ones. */
export function mergeFiles(current: File[], incoming: Iterable<File>): File[] {
  const seen = new Set(current.map(fileKey));
  const next = [...current];
  for (const file of incoming) {
    const key = fileKey(file);
    if (!seen.has(key)) {
      seen.add(key);
      next.push(file);
    }
  }
  return next;
}

export async function uploadEach(files: File[], send: (file: File) => Promise<unknown>): Promise<UploadResult> {
  const result: UploadResult = { uploaded: [], failed: [] };
  for (const file of files) {
    try {
      await send(file);
      result.uploaded.push(file);
    } catch (error) {
      result.failed.push({ name: file.name, message: error instanceof Error ? error.message : "Ошибка загрузки" });
    }
  }
  return result;
}

/** Human summary of a partially failed batch; empty when everything was uploaded. */
export function uploadFailureMessage(result: UploadResult): string {
  if (!result.failed.length) return "";
  const details = result.failed.map((item) => `«${item.name}»: ${item.message}`).join("; ");
  const total = result.uploaded.length + result.failed.length;
  return result.uploaded.length
    ? `Загружено ${result.uploaded.length} из ${total}. Не удалось загрузить: ${details}`
    : `Не удалось загрузить: ${details}`;
}
