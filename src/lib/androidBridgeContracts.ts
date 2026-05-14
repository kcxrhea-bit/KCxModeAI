import type {
  AndroidBridgeRequest,
  AndroidBridgeStatusResponse,
  StructuredAiResponse,
} from '../types'

export const androidBridgeRequestTypes = [
  'health_summary',
  'note_cleanup',
  'task_extraction',
  'memory_sync',
  'focus_helper',
  'senior_helper',
] as const

export const createBridgePingResponse = (
  message = 'Android bridge is prepared for future local sync. Not active yet.',
): AndroidBridgeStatusResponse => ({
  // Future-safe placeholders:
  // - local/Tailscale transport only (no public internet exposure)
  // - optional QR pairing flow
  // - optional encrypted payload support
  // - future GodzillaMode launcher coordination over local-only bridge contracts
  // - future offline-first workflow sync summaries for notes/tasks/focus/family/senior
  // - future AI-safe memory preview sync with explicit local eligibility checks
  ok: true,
  status: 'placeholder',
  bridgeMode: 'off',
  enabled: false,
  message,
  checkedAt: new Date().toISOString(),
})

export type AndroidBridgeHandlerResult = {
  ok: boolean
  message: string
  response?: StructuredAiResponse
}

export type AndroidSyncCategory =
  | 'notes'
  | 'tasks'
  | 'workflow_routines'
  | 'memory_highlights'
  | 'focus_routines'
  | 'family_senior_preference_summaries'

export interface AndroidSyncPreviewItem {
  category: AndroidSyncCategory
  estimatedCount: number
  localOnly: true
  syncEligible: boolean
}

export const validateAndroidBridgeRequest = (
  value: unknown,
): value is AndroidBridgeRequest => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : ''
  return androidBridgeRequestTypes.some((allowed) => allowed === type)
}
