import { cmdDown } from '../../../scripts/e2e-compose.mjs';

type ExecComposeFn = (
  composeFile: string,
  args: string[],
  context: { env: NodeJS.ProcessEnv; project: string },
) => Promise<string>;

export type TeardownOptions = {
  track?: string;
  execFn?: ExecComposeFn;
  log?: (message: string) => void;
};

/**
 * Tear down E2E compose stack for standard/plus tracks (AC-073).
 * Lite track skips compose; unknown tracks throw.
 */
export async function teardownCompose(
  options: TeardownOptions = {},
): Promise<void> {
  const track = (options.track ?? process.env.RXWF_E2E_TRACK)
    ?.trim()
    .toLowerCase();

  if (!track || track === 'lite') {
    return;
  }

  if (track !== 'standard' && track !== 'plus') {
    throw new Error(
      `Unknown RXWF_E2E_TRACK "${track}". Expected standard, plus, or lite.`,
    );
  }

  await cmdDown(track, {
    execFn: options.execFn,
    log: options.log,
  });
}

export default async function globalTeardown(): Promise<void> {
  await teardownCompose();
}
