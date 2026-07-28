/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'node-runner-no-lite',
      severity: 'error',
      from: { path: '^packages/node-runner' },
      to: { path: '^packages/providers/lite' },
    },
    {
      name: 'execution-no-lite',
      severity: 'error',
      from: { path: '^packages/execution' },
      to: { path: '^packages/providers/lite' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
