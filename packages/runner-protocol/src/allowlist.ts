export const REMOTE_V1_1_NODE_TYPES = [
  'code',
  'executeCommand',
  'httpRequest',
  'readWriteFile',
] as const;
export type RemoteV11NodeType = (typeof REMOTE_V1_1_NODE_TYPES)[number];

export function isRemoteV11NodeType(nodeType: string): nodeType is RemoteV11NodeType {
  return (REMOTE_V1_1_NODE_TYPES as readonly string[]).includes(nodeType);
}
