export type ExecuteNodeOptions = {
  /** 是否在画布上选中该节点，默认 true */
  selectOnCanvas?: boolean;
};

export type ExecuteNodeFn = (
  nodeId: string,
  options?: ExecuteNodeOptions,
) => void | Promise<void>;

/**
 * Run main-flow predecessors from the trigger node through the chain;
 * skips already-executed nodes; stops before the editor node.
 */
export type ExecutePredecessorsFn = (editorNodeId: string) => void | Promise<void>;
