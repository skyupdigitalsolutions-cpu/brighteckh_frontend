// G4 (open question in Figma "90 · Open questions"): every photo gate takes a `file_uri`,
// but the API has NO file upload / signed-URL endpoint. Until one exists, this adapter
// mints a placeholder URI that identifies the capture; the bytes stay on the device.
//
// Replace `storeFile` with the real upload once the backend exposes it — callers only
// depend on the returned { file_uri, file_name }.

export const UPLOAD_IS_PLACEHOLDER = true;

export async function storeFile(file: File): Promise<{ file_uri: string; file_name: string }> {
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'photo.jpg';
  return { file_uri: `pending-upload://${id}/${safeName}`, file_name: safeName };
}
