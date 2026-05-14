import type { WorkflowRoutine } from '../types'

type RunOptions = {
  onStep?: (stepTitle: string) => void
}

const clampDelay = (value: number | undefined) => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(Math.max(Math.round(value ?? 0), 0), 3600)
}

const wait = (seconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, seconds * 1000)
  })

export const runWorkflowRoutine = async (
  routine: WorkflowRoutine,
  options?: RunOptions,
): Promise<{ ok: boolean; message: string }> => {
  // Future-safe placeholder:
  // - Android companion sync can subscribe to routine completion metadata.
  // - Local encrypted workflow journals can be added before any export feature.
  // - Optional local notifications can be layered on top without background services.
  // - AI-assisted workflow suggestions should stay recommendation-only, never autonomous.
  try {
    for (const step of routine.steps) {
      options?.onStep?.(step.title)
      const delay = clampDelay(step.delaySeconds)
      if (delay > 0) {
        await wait(delay)
      }
    }

    return {
      ok: true,
      message: `${routine.name} completed locally.`,
    }
  } catch {
    return {
      ok: false,
      message: `${routine.name} failed safely.`,
    }
  }
}
