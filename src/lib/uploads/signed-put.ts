/**
 * Browser half of the Storage upload pipeline: PUTs a file straight to a
 * Supabase signed upload URL, reporting progress. Used for article images
 * (admin) and reader avatars; the server verifies the file afterwards.
 */
export function putToSignedUrl(signedUrl: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}
