/** Extension manifest — validated at startup and aggregated into Agent capabilities / nodeTypes. */
export interface RunnerExtensionManifest {
  /** Globally unique ID, e.g. "@acme/rxwf-wmi-executor" */
  id: string;
  /** Extension semver */
  version: string;
  /** Capability tags merged into Agent registration */
  capabilities?: string[];
  /** Supported node.type list; should match registerExecutor calls */
  nodeTypes?: string[];
  /** Compatible runner-sdk version range, e.g. "^1.0.0" */
  runnerSdk: string;
  /** Optional compatible AWF server version range */
  awfServer?: string;
  /** Optional human-readable description */
  description?: string;
}
