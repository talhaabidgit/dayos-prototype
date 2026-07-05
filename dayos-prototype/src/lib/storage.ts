export async function saveToDirectory(
  blobs: { blob: Blob; name: string }[],
): Promise<void> {
  // Try File System Access API first
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
      for (const { blob, name } of blobs) {
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      return;
    } catch (err) {
      // User cancelled or API denied — fall through to download
      if ((err as DOMException).name === 'AbortError') {
        throw new Error('Directory selection was cancelled');
      }
    }
  }

  // Fallback: download each file individually
  for (const { blob, name } of blobs) {
    downloadBlob(blob, name);
    // Small delay to prevent browser blocking multiple downloads
    await new Promise(r => setTimeout(r, 300));
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}