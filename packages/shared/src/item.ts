export type BinaryBlobRef = {
  blobId: string;
};

export type BinaryAttachment = {
  /** base64 inline data; empty when externalized to blob */
  data: string;
  mimeType: string;
  fileName?: string;
  /** Decoded byte length */
  fileSize?: number;
  ref?: BinaryBlobRef;
};

export type BinaryMap = Record<string, BinaryAttachment>;

export interface WorkflowItem {
  json: Record<string, unknown>;
  binary?: BinaryMap;
}
