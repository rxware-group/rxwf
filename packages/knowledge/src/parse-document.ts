import pdfParse from 'pdf-parse';

const MAX_BYTES = 50 * 1024 * 1024;

export function assertDocumentSize(byteLength: number): void {
  if (byteLength > MAX_BYTES) {
    throw new Error('Document exceeds 50MB limit');
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  assertDocumentSize(buffer.length);
  const lower = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (mime.includes('pdf') || lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    return parsed.text ?? '';
  }

  if (
    mime.includes('html') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm')
  ) {
    const raw = buffer.toString('utf8');
    return stripHtml(raw);
  }

  if (
    mime.includes('markdown') ||
    mime.includes('text/') ||
    lower.endsWith('.md') ||
    lower.endsWith('.txt')
  ) {
    return buffer.toString('utf8');
  }

  throw new Error(`Unsupported document type: ${mimeType || fileName}`);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
