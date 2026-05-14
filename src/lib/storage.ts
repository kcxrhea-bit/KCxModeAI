import { createDefaultAppData, defaultAppInfo } from './defaults'
import type {
  ActivityEntry,
  ActivityType,
  AndroidBridgeSettings,
  AppData,
  AppInfo,
  AppView,
  ChatMessage,
  ChecklistItem,
  Conversation,
  DashboardSectionId,
  DashboardWidgetId,
  HelperPreferences,
  LocalAiSettings,
  MemoryCategory,
  MemoryEntry,
  MemoryImportance,
  MemorySortOrder,
  NetworkStatus,
  PrivateBrowserAccessConfig,
  PrivateBrowserAccessStatus,
  NoteTemplate,
  OllamaCheckResponse,
  OllamaGenerateResponse,
  OllamaModelsResponse,
  OllamaStatus,
  NotesWorkflowState,
  NotesWorkflowTab,
  ProviderId,
  QuickActionId,
  ReminderItem,
  RemoteAccessSettings,
  SecuritySettings,
  ReleaseSettings,
  StructuredAiResponse,
  SyncConflictSummary,
  SyncSession,
  SyncSettings,
  SyncMetadata,
  TaskFilterStatus,
  TaskItem,
  TaskPriority,
  ThemePreference,
  UiPreferences,
  WorkflowRoutine,
  WorkflowRuntimeState,
  WorkflowStepType,
  TesterSettings,
  AccessibilitySettings,
  AndroidEcosystemSettings,
} from '../types'

const storageKey = 'godzillamodeai-local-data-v1'
const corruptStorageKey = 'godzillamodeai-local-data-corrupt'
type BrowserStorageRuntimeMode =
  | 'electron_local_file'
  | 'remote_pc_host'
  | 'browser_local_storage'
type BridgeStatusResponse = {
  ok: true
  hostMode: 'localhost_only' | 'lan' | 'tailscale'
  appName: string
  version: string
  bridgeAvailable: true
  localOnly: true
  checkedAt: string
}
const bridgeProbeState: {
  mode: BrowserStorageRuntimeMode
  checkedAt: number
  bridgeAvailable: boolean
  loadedHostDataAtLeastOnce: boolean
  message: string
} = {
  mode: window.godzillaAPI ? 'electron_local_file' : 'browser_local_storage',
  checkedAt: 0,
  bridgeAvailable: false,
  loadedHostDataAtLeastOnce: false,
  message: window.godzillaAPI
    ? 'Using Electron local file storage.'
    : 'Using this browser local storage.',
}

const cloneDefaultData = () => createDefaultAppData()

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const asBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

const asArray = (value: unknown) => (Array.isArray(value) ? value : [])
const createDefaultSyncMeta = (stamp = new Date().toISOString()): SyncMetadata => ({
  lastModified: stamp,
  syncEligible: true,
  syncVersion: 1,
  deviceSource: 'desktop_local' as const,
  pendingSync: false,
  localOnly: true,
})
const normalizeDeviceSource = (value: unknown): SyncMetadata['deviceSource'] =>
  value === 'android_future' || value === 'unknown' ? value : 'desktop_local'

const normalizeProviderId = (value: unknown): ProviderId => {
  switch (value) {
    case 'ollama':
      return value
    default:
      return 'rule-based'
  }
}

const normalizeThemePreference = (value: unknown): ThemePreference =>
  value === 'midnight' ? 'midnight' : 'godzilla'

const normalizeView = (value: unknown): AppView => {
  switch (value) {
    case 'chat':
    case 'health':
    case 'notes':
    case 'focus':
    case 'family':
    case 'senior':
    case 'memory':
    case 'settings':
      return value
    default:
      return 'dashboard'
  }
}

const normalizeNotesTab = (value: unknown): NotesWorkflowTab => {
  switch (value) {
    case 'shopping':
    case 'tasks':
      return value
    default:
      return 'clean'
  }
}

const normalizeMemorySortOrder = (value: unknown): MemorySortOrder =>
  value === 'oldest' ? 'oldest' : 'newest'

const normalizeImportance = (value: unknown): MemoryImportance =>
  value === 'low' || value === 'important' || value === 'high' ? value : 'normal'

const normalizeTaskPriority = (value: unknown): TaskPriority => {
  switch (value) {
    case 'low':
    case 'high':
      return value
    default:
      return 'normal'
  }
}

const normalizeTaskFilterStatus = (value: unknown): TaskFilterStatus => {
  switch (value) {
    case 'active':
    case 'completed':
    case 'overdue':
      return value
    default:
      return 'all'
  }
}

const normalizeTemplate = (value: unknown): NoteTemplate => {
  switch (value) {
    case 'meeting_notes':
    case 'doctor_note':
    case 'grocery_planning':
    case 'focus_session':
    case 'checklist':
      return value
    default:
      return 'blank'
  }
}

const normalizeCategory = (value: unknown): MemoryCategory => {
  const fallback: MemoryCategory = 'note'
  const allowed = new Set<MemoryCategory>([
    'preference',
    'workflow',
    'productivity',
    'conversation_highlight',
    'safe_note',
    'pinned',
    'health_context',
    'blood_sugar',
    'medicine',
    'symptom',
    'user_preference',
    'app_context',
    'note',
    'reminder',
    'shopping',
    'task',
    'godzilla_mode_setting',
  ])

  return typeof value === 'string' && allowed.has(value as MemoryCategory)
    ? (value as MemoryCategory)
    : fallback
}

const normalizeTags = (value: unknown) =>
  asArray(value)
    .map((item) => asString(item).trim())
    .filter(Boolean)
    .slice(0, 12)

const normalizeChecklistItem = (value: unknown, index: number): ChecklistItem | null => {
  if (!isObject(value)) {
    return null
  }

  const label = asString(value.label).trim()
  if (!label) {
    return null
  }

  return {
    id: asString(value.id, `item-${index}`),
    label,
    completed: asBoolean(value.completed),
  }
}

const normalizeTaskItem = (value: unknown, index: number): TaskItem | null => {
  if (!isObject(value)) {
    return null
  }

  const label = asString(value.label).trim()
  if (!label) {
    return null
  }

  const stamp = new Date().toISOString()
  const syncMeta = isObject(value.syncMeta)
    ? {
        lastModified: asString(value.syncMeta.lastModified, stamp),
        syncEligible: asBoolean(value.syncMeta.syncEligible, true),
        syncVersion: Number(value.syncMeta.syncVersion) || 1,
        deviceSource: normalizeDeviceSource(value.syncMeta.deviceSource),
        pendingSync: asBoolean(value.syncMeta.pendingSync),
        localOnly: asBoolean(value.syncMeta.localOnly, true),
      }
    : createDefaultSyncMeta(stamp)
  return {
    id: asString(value.id, `task-${index}-${Date.now()}`),
    label,
    completed: asBoolean(value.completed),
    dueDate:
      typeof value.dueDate === 'string' || value.dueDate === null ? value.dueDate : null,
    priority: normalizeTaskPriority(value.priority),
    category: asString(value.category, 'general'),
    pinned: asBoolean(value.pinned),
    syncMeta,
    createdAt: asString(value.createdAt, stamp),
    updatedAt: asString(value.updatedAt, stamp),
  }
}

const normalizeMemoryEntry = (value: unknown, index: number): MemoryEntry | null => {
  if (!isObject(value)) {
    return null
  }

  const title = asString(value.title).trim()
  const content = asString(value.content).trim()

  if (!title && !content) {
    return null
  }

  const stamp = new Date().toISOString()
  const syncMeta = isObject(value.syncMeta)
    ? {
        lastModified: asString(value.syncMeta.lastModified, stamp),
        syncEligible: asBoolean(value.syncMeta.syncEligible, true),
        syncVersion: Number(value.syncMeta.syncVersion) || 1,
        deviceSource: normalizeDeviceSource(value.syncMeta.deviceSource),
        pendingSync: asBoolean(value.syncMeta.pendingSync),
        localOnly: asBoolean(value.syncMeta.localOnly, true),
      }
    : createDefaultSyncMeta(stamp)

  return {
    id: asString(value.id, `memory-${index}-${Date.now()}`),
    category: normalizeCategory(value.category),
    title: title || 'Untitled Memory',
    content: content || 'No content saved.',
    source: asString(value.source, 'unknown'),
    tags: normalizeTags(value.tags),
    pinned: asBoolean(value.pinned),
    favorite: asBoolean(value.favorite),
    importance: normalizeImportance(value.importance),
    safeForLocalAi: asBoolean(value.safeForLocalAi),
    archived: asBoolean(value.archived),
    syncMeta,
    createdAt: asString(value.createdAt, stamp),
    updatedAt: asString(value.updatedAt, stamp),
  }
}

const normalizeStructuredResponse = (
  value: unknown,
  fallbackText: string,
): StructuredAiResponse | undefined => {
  if (!isObject(value)) {
    return undefined
  }

  return {
    type: asString(value.type, 'general'),
    title: asString(value.title, 'Local Assistant Response'),
    responseText: asString(value.responseText, fallbackText),
    bullets: asArray(value.bullets).map((item) => asString(item)).filter(Boolean),
    suggestedActions: asArray(value.suggestedActions)
      .map((item) => asString(item))
      .filter(Boolean),
    safetyLevel:
      value.safetyLevel === 'caution' ||
      value.safetyLevel === 'urgent' ||
      value.safetyLevel === 'info'
        ? value.safetyLevel
        : 'normal',
    memoryUpdates: asArray(value.memoryUpdates)
      .map((item) => asString(item))
      .filter(Boolean),
  }
}

const normalizeChatMessage = (value: unknown, index: number): ChatMessage | null => {
  if (!isObject(value)) {
    return null
  }

  const role = value.role === 'assistant' ? 'assistant' : value.role === 'user' ? 'user' : null
  const content = asString(value.content).trim()

  if (!role || !content) {
    return null
  }

  return {
    id: asString(value.id, `chat-${index}-${Date.now()}`),
    role,
    content,
    createdAt: asString(value.createdAt, new Date().toISOString()),
    response: normalizeStructuredResponse(value.response, content),
  }
}

const normalizeConversation = (value: unknown, index: number): Conversation | null => {
  if (!isObject(value)) {
    return null
  }

  const title = asString(value.title).trim()
  const createdAt = asString(value.createdAt, new Date().toISOString())
  const messages = asArray(value.messages)
    .map((entry, messageIndex) => normalizeChatMessage(entry, messageIndex))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  return {
    id: asString(value.id, `conversation-${index}-${Date.now()}`),
    title: title || `Conversation ${index + 1}`,
    createdAt,
    updatedAt: asString(value.updatedAt, createdAt),
    pinned: asBoolean(value.pinned),
    messages,
  }
}

const normalizeUiPreferences = (value: unknown, fallback: UiPreferences): UiPreferences => {
  if (!isObject(value)) {
    return fallback
  }

  return {
    themePreference: normalizeThemePreference(value.themePreference),
    sidebarCollapsed: asBoolean(value.sidebarCollapsed, fallback.sidebarCollapsed),
    lastView: normalizeView(value.lastView),
    memorySearch: asString(value.memorySearch, fallback.memorySearch),
    memoryCategoryFilter:
      value.memoryCategoryFilter === 'all'
        ? 'all'
        : normalizeCategory(value.memoryCategoryFilter),
    memoryPinnedOnly: asBoolean(value.memoryPinnedOnly, fallback.memoryPinnedOnly),
    memoryTagFilter: asString(value.memoryTagFilter, fallback.memoryTagFilter),
    memoryArchivedOnly: asBoolean(
      value.memoryArchivedOnly,
      fallback.memoryArchivedOnly,
    ),
    memorySortOrder: normalizeMemorySortOrder(value.memorySortOrder),
    notesActiveTab: normalizeNotesTab(value.notesActiveTab),
  }
}

const normalizeWorkflowRoutine = (
  value: unknown,
  index: number,
  fallback: WorkflowRoutine[],
): WorkflowRoutine | null => {
  if (!isObject(value)) {
    return null
  }
  const fallbackEntry = fallback[index] ?? fallback[0]
  const status =
    value.status === 'running' ||
    value.status === 'completed' ||
    value.status === 'failed'
      ? value.status
      : 'idle'
  const category =
    value.category === 'morning_routine' ||
    value.category === 'focus_session' ||
    value.category === 'daily_planning' ||
    value.category === 'wind_down' ||
    value.category === 'notes_cleanup'
      ? value.category
      : 'custom'

  const steps = asArray(value.steps)
    .map((step, stepIndex) => {
      if (!isObject(step)) {
        return null
      }
      const title = asString(step.title).trim()
      if (!title) {
        return null
      }
      const stepType: WorkflowStepType =
        step.type === 'checklist' ||
        step.type === 'timer' ||
        step.type === 'review'
          ? step.type
          : 'prompt'
      const rawDelay = Number(step.delaySeconds)
      return {
        id: asString(step.id, `workflow-step-${index}-${stepIndex}`),
        title,
        detail: asString(step.detail),
        type: stepType,
        delaySeconds:
          Number.isFinite(rawDelay) && rawDelay > 0
            ? Math.min(Math.round(rawDelay), 3600)
            : undefined,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  const routineSyncMeta = isObject(value.syncMeta)
    ? {
        lastModified: asString(value.syncMeta.lastModified, new Date().toISOString()),
        syncEligible: asBoolean(value.syncMeta.syncEligible, true),
        syncVersion: Number(value.syncMeta.syncVersion) || 1,
        deviceSource: normalizeDeviceSource(value.syncMeta.deviceSource),
        pendingSync: asBoolean(value.syncMeta.pendingSync),
        localOnly: asBoolean(value.syncMeta.localOnly, true),
      }
    : createDefaultSyncMeta()

  return {
    id: asString(value.id, `workflow-${index}`),
    name: asString(value.name, fallbackEntry?.name ?? `Workflow ${index + 1}`),
    description: asString(value.description, fallbackEntry?.description ?? ''),
    category,
    trigger: 'manual',
    enabled: asBoolean(value.enabled, true),
    status,
    lastRunAt:
      typeof value.lastRunAt === 'string' || value.lastRunAt === null ? value.lastRunAt : null,
    syncMeta: routineSyncMeta,
    steps: steps.length > 0 ? steps : fallbackEntry?.steps ?? [],
  }
}

const normalizeWorkflowRuntime = (
  value: unknown,
  fallback: WorkflowRuntimeState,
): WorkflowRuntimeState => {
  if (!isObject(value)) {
    return fallback
  }
  return {
    activeRoutineId: asString(value.activeRoutineId) || null,
    status:
      value.status === 'running' || value.status === 'completed' || value.status === 'failed'
        ? value.status
        : 'idle',
    message: asString(value.message, fallback.message),
    updatedAt:
      typeof value.updatedAt === 'string' || value.updatedAt === null
        ? value.updatedAt
        : fallback.updatedAt,
  }
}

const normalizeHelperPreferences = (
  value: unknown,
  fallback: HelperPreferences,
): HelperPreferences => {
  if (!isObject(value)) {
    return fallback
  }

  return {
    notesRememberDrafts: asBoolean(
      value.notesRememberDrafts,
      fallback.notesRememberDrafts,
    ),
    focusPreset:
      value.focusPreset === 'deep_work' || value.focusPreset === 'reentry'
        ? value.focusPreset
        : 'quick_reset',
    focusTimerMinutes: (() => {
      const parsed = Number(value.focusTimerMinutes)
      return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), 5), 120) : 25
    })(),
    familyTemplate:
      value.familyTemplate === 'routine_reset' || value.familyTemplate === 'screen_time'
        ? value.familyTemplate
        : 'calm_boundary',
    seniorEasyMode: asBoolean(value.seniorEasyMode, false),
  }
}

const normalizeRemoteAccessSettings = (
  value: unknown,
  fallback: RemoteAccessSettings,
): RemoteAccessSettings => {
  if (!isObject(value)) {
    return fallback
  }

  const mode = value.mode === 'hybrid_ready' ? 'hybrid_ready' : 'local_only'

  return {
    mode,
    tailscaleEnabled: asBoolean(value.tailscaleEnabled, fallback.tailscaleEnabled),
    remoteSyncPlanned: asBoolean(value.remoteSyncPlanned, fallback.remoteSyncPlanned),
    remoteApiBridgeEnabled: asBoolean(
      value.remoteApiBridgeEnabled,
      fallback.remoteApiBridgeEnabled,
    ),
    remoteAiRequestsEnabled: asBoolean(
      value.remoteAiRequestsEnabled,
      fallback.remoteAiRequestsEnabled,
    ),
    androidCompanionPlanned: asBoolean(
      value.androidCompanionPlanned,
      fallback.androidCompanionPlanned,
    ),
    browserAccessEnabled: asBoolean(
      value.browserAccessEnabled,
      fallback.browserAccessEnabled,
    ),
    browserHostMode:
      value.browserHostMode === 'lan' || value.browserHostMode === 'tailscale'
        ? value.browserHostMode
        : 'localhost_only',
    browserBindHost: asString(value.browserBindHost, fallback.browserBindHost),
    browserPort: (() => {
      const parsed = Number(value.browserPort)
      return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535
        ? Math.round(parsed)
        : fallback.browserPort
    })(),
    localAccessPin: asString(value.localAccessPin, fallback.localAccessPin),
    trustedNetworkLabel: asString(
      value.trustedNetworkLabel,
      fallback.trustedNetworkLabel,
    ),
  }
}

const normalizeAndroidBridgeSettings = (
  value: unknown,
  fallback: AndroidBridgeSettings,
): AndroidBridgeSettings => {
  if (!isObject(value)) {
    return fallback
  }

  const bridgeMode =
    value.bridgeMode === 'local_only' || value.bridgeMode === 'tailscale_ready'
      ? value.bridgeMode
      : 'off'

  const normalizeDevice = (entry: unknown, index: number) => {
    if (!isObject(entry)) {
      return null
    }
    const id = asString(entry.id, `device-${index}`).trim()
    const label = asString(entry.label).trim()
    if (!label) {
      return null
    }
    return { id, label }
  }

  const normalizePairedDevice = (entry: unknown, index: number) => {
    if (!isObject(entry)) {
      return null
    }
    const normalized = normalizeDevice(entry, index)
    if (!normalized) {
      return null
    }
    return {
      ...normalized,
      lastSeenAt:
        typeof entry.lastSeenAt === 'string' || entry.lastSeenAt === null
          ? entry.lastSeenAt
          : null,
    }
  }

  const rawPort = Number(value.localBridgePort)
  const localBridgePort =
    Number.isFinite(rawPort) && rawPort >= 1024 && rawPort <= 65535
      ? Math.round(rawPort)
      : fallback.localBridgePort

  return {
    enabled: asBoolean(value.enabled, fallback.enabled),
    localBridgePort,
    bridgeMode,
    pairingCode: asString(value.pairingCode, fallback.pairingCode),
    allowedDevices: asArray(value.allowedDevices)
      .map((entry, index) => normalizeDevice(entry, index))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    pairedDevices: asArray(value.pairedDevices)
      .map((entry, index) => normalizePairedDevice(entry, index))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    lastSeenAt:
      typeof value.lastSeenAt === 'string' || value.lastSeenAt === null
        ? value.lastSeenAt
        : fallback.lastSeenAt,
    syncPreviewLastCheckedAt:
      typeof value.syncPreviewLastCheckedAt === 'string' ||
      value.syncPreviewLastCheckedAt === null
        ? value.syncPreviewLastCheckedAt
        : fallback.syncPreviewLastCheckedAt,
    syncPairingPlaceholder: asString(
      value.syncPairingPlaceholder,
      fallback.syncPairingPlaceholder,
    ),
  }
}

const normalizeLocalAiSettings = (
  value: unknown,
  fallback: LocalAiSettings,
): LocalAiSettings => {
  if (!isObject(value)) {
    return fallback
  }

  const ollama = isObject(value.ollama) ? value.ollama : {}
  const providerMode = value.providerMode === 'ollama' ? 'ollama' : 'rule_based'
  const hasCanonicalEnabled = typeof ollama.enabled === 'boolean'
  const legacyEnabled = asBoolean(
    value.ollamaEnabled,
    asBoolean(value.enableOllama, providerMode === 'ollama'),
  )

  return {
    providerMode,
    ollama: {
      enabled: hasCanonicalEnabled
        ? asBoolean(ollama.enabled, fallback.ollama.enabled)
        : legacyEnabled,
      baseUrl: asString(ollama.baseUrl, fallback.ollama.baseUrl),
      selectedModel: asString(ollama.selectedModel, fallback.ollama.selectedModel),
      availableModels: asArray(ollama.availableModels)
        .map((item) => asString(item).trim())
        .filter(Boolean),
      lastStatus:
        ollama.lastStatus === 'checking' ||
        ollama.lastStatus === 'ready' ||
        ollama.lastStatus === 'error'
          ? ollama.lastStatus
          : 'unavailable',
      lastCheckedAt:
        typeof ollama.lastCheckedAt === 'string' || ollama.lastCheckedAt === null
          ? ollama.lastCheckedAt
          : fallback.ollama.lastCheckedAt,
      errorMessage: asString(ollama.errorMessage, fallback.ollama.errorMessage),
    },
    context: {
      contextMode:
        value.contextMode === 'recent_chat_only' || value.contextMode === 'extended_chat'
          ? value.contextMode
          : isObject(value.context) &&
              (value.context.contextMode === 'recent_chat_only' ||
                value.context.contextMode === 'extended_chat')
            ? value.context.contextMode
            : 'minimal',
      maxContextMessages: (() => {
        const source = isObject(value.context) ? value.context.maxContextMessages : value.maxContextMessages
        const parsed = Number(source)
        if (!Number.isFinite(parsed)) {
          return fallback.context.maxContextMessages
        }
        return Math.min(Math.max(Math.round(parsed), 1), 40)
      })(),
      allowConversationTitles: asBoolean(
        isObject(value.context) ? value.context.allowConversationTitles : undefined,
        fallback.context.allowConversationTitles,
      ),
      allowTaskContext: asBoolean(
        isObject(value.context) ? value.context.allowTaskContext : undefined,
        fallback.context.allowTaskContext,
      ),
      allowNotesContext: asBoolean(
        isObject(value.context) ? value.context.allowNotesContext : undefined,
        fallback.context.allowNotesContext,
      ),
      allowMemoryHighlights: asBoolean(
        isObject(value.context) ? value.context.allowMemoryHighlights : undefined,
        fallback.context.allowMemoryHighlights,
      ),
    },
  }
}

const normalizeSyncSettings = (
  value: unknown,
  fallback: SyncSettings,
): SyncSettings => {
  if (!isObject(value)) {
    return fallback
  }

  const pairingRequest = isObject(value.pairingRequest) ? value.pairingRequest : {}

  return {
    allowLanSyncPrep: asBoolean(value.allowLanSyncPrep, fallback.allowLanSyncPrep),
    allowLocalhostBridgePrep: asBoolean(
      value.allowLocalhostBridgePrep,
      fallback.allowLocalhostBridgePrep,
    ),
    allowTailscaleSyncPrep: asBoolean(
      value.allowTailscaleSyncPrep,
      fallback.allowTailscaleSyncPrep,
    ),
    trustedDevicePlaceholders: asArray(value.trustedDevicePlaceholders)
      .map((entry, index) => {
        if (!isObject(entry)) {
          return null
        }
        const label = asString(entry.label).trim()
        if (!label) {
          return null
        }
        return {
          id: asString(entry.id, `trusted-${index}`),
          label,
          lastSeenAt:
            typeof entry.lastSeenAt === 'string' || entry.lastSeenAt === null
              ? entry.lastSeenAt
              : null,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    pairingRequest: {
      requestId: asString(pairingRequest.requestId),
      status:
        pairingRequest.status === 'pending' ||
        pairingRequest.status === 'accepted' ||
        pairingRequest.status === 'rejected' ||
        pairingRequest.status === 'revoked'
          ? pairingRequest.status
          : 'idle',
      requestedAt:
        typeof pairingRequest.requestedAt === 'string' || pairingRequest.requestedAt === null
          ? pairingRequest.requestedAt
          : null,
      expiresAt:
        typeof pairingRequest.expiresAt === 'string' || pairingRequest.expiresAt === null
          ? pairingRequest.expiresAt
          : null,
    },
    lastSyncSessionId: asString(value.lastSyncSessionId) || null,
  }
}

const normalizeReminderItem = (value: unknown, index: number): ReminderItem | null => {
  if (!isObject(value)) {
    return null
  }
  const title = asString(value.title).trim()
  const remindAt = asString(value.remindAt).trim()
  if (!title || !remindAt) {
    return null
  }

  return {
    id: asString(value.id, `reminder-${index}`),
    type:
      value.type === 'task' || value.type === 'focus' || value.type === 'notes_review'
        ? value.type
        : 'workflow',
    title,
    enabled: asBoolean(value.enabled, true),
    remindAt,
    frequency:
      value.frequency === 'daily' || value.frequency === 'weekly' || value.frequency === 'monthly'
        ? value.frequency
        : 'none',
    nextReminderAt:
      typeof value.nextReminderAt === 'string' || value.nextReminderAt === null
        ? value.nextReminderAt
        : null,
    lastTriggeredAt:
      typeof value.lastTriggeredAt === 'string' || value.lastTriggeredAt === null
        ? value.lastTriggeredAt
        : null,
    localOnly: true,
  }
}

const normalizeReleaseSettings = (
  value: unknown,
  fallback: ReleaseSettings,
): ReleaseSettings => {
  if (!isObject(value)) {
    return fallback
  }
  const prep = isObject(value.packagingPrep) ? value.packagingPrep : {}
  return {
    buildChannel: value.buildChannel === 'production' ? 'production' : 'development',
    releaseType:
      value.releaseType === 'beta_prep' || value.releaseType === 'stable_prep'
        ? value.releaseType
        : 'dev_snapshot',
    environmentStatus:
      value.environmentStatus === 'desktop_shell' || value.environmentStatus === 'packaged_desktop'
        ? value.environmentStatus
        : 'browser_fallback',
    packagingPrep: {
      installerReadyPlaceholder: asBoolean(
        prep.installerReadyPlaceholder,
        fallback.packagingPrep.installerReadyPlaceholder,
      ),
      portableModeReadyPlaceholder: asBoolean(
        prep.portableModeReadyPlaceholder,
        fallback.packagingPrep.portableModeReadyPlaceholder,
      ),
      optionalUpdaterPlanned: asBoolean(
        prep.optionalUpdaterPlanned,
        fallback.packagingPrep.optionalUpdaterPlanned,
      ),
    },
  }
}

const normalizeSecuritySettings = (
  value: unknown,
  fallback: SecuritySettings,
): SecuritySettings => {
  if (!isObject(value)) {
    return fallback
  }
  const encryptionPrep = isObject(value.encryptionPrep) ? value.encryptionPrep : {}
  const partitioning = isObject(value.partitioning) ? value.partitioning : {}
  return {
    encryptionPrep: {
      encryptedLocalExportPlanned: asBoolean(
        encryptionPrep.encryptedLocalExportPlanned,
        fallback.encryptionPrep.encryptedLocalExportPlanned,
      ),
      encryptedSyncPayloadPlanned: asBoolean(
        encryptionPrep.encryptedSyncPayloadPlanned,
        fallback.encryptionPrep.encryptedSyncPayloadPlanned,
      ),
      encryptedMemoryCategoriesPlanned: asBoolean(
        encryptionPrep.encryptedMemoryCategoriesPlanned,
        fallback.encryptionPrep.encryptedMemoryCategoriesPlanned,
      ),
      securePairingPlanned: asBoolean(
        encryptionPrep.securePairingPlanned,
        fallback.encryptionPrep.securePairingPlanned,
      ),
    },
    partitioning: {
      healthSensitiveCategories: asArray(partitioning.healthSensitiveCategories)
        .map((item) => normalizeCategory(item))
        .slice(0, 10),
      familySeniorSensitiveCategories: asArray(partitioning.familySeniorSensitiveCategories)
        .map((item) => normalizeCategory(item))
        .slice(0, 10),
      localAiSafeOnlyVisibility: asBoolean(
        partitioning.localAiSafeOnlyVisibility,
        fallback.partitioning.localAiSafeOnlyVisibility,
      ),
      exportSafeOnlyVisibility: asBoolean(
        partitioning.exportSafeOnlyVisibility,
        fallback.partitioning.exportSafeOnlyVisibility,
      ),
      syncEligibleOnlyVisibility: asBoolean(
        partitioning.syncEligibleOnlyVisibility,
        fallback.partitioning.syncEligibleOnlyVisibility,
      ),
    },
    localOnlyIndicatorsEnabled: asBoolean(
      value.localOnlyIndicatorsEnabled,
      fallback.localOnlyIndicatorsEnabled,
    ),
  }
}

const normalizeTesterSettings = (
  value: unknown,
  fallback: TesterSettings,
): TesterSettings => {
  if (!isObject(value)) {
    return fallback
  }
  const feedback = isObject(value.feedback) ? value.feedback : {}
  const debugTools = isObject(value.debugTools) ? value.debugTools : {}
  return {
    feedback: {
      testerNotes: asString(feedback.testerNotes, fallback.feedback.testerNotes),
      bugReportDraft: asString(feedback.bugReportDraft, fallback.feedback.bugReportDraft),
      localFeedbackQueue: asArray(feedback.localFeedbackQueue)
        .map((item) => asString(item).trim())
        .filter(Boolean)
        .slice(0, 50),
    },
    debugTools: {
      compactResetPrepEnabled: asBoolean(
        debugTools.compactResetPrepEnabled,
        fallback.debugTools.compactResetPrepEnabled,
      ),
      safeCacheClearPrepEnabled: asBoolean(
        debugTools.safeCacheClearPrepEnabled,
        fallback.debugTools.safeCacheClearPrepEnabled,
      ),
      workflowResetPrepEnabled: asBoolean(
        debugTools.workflowResetPrepEnabled,
        fallback.debugTools.workflowResetPrepEnabled,
      ),
      importExportValidationPrepEnabled: asBoolean(
        debugTools.importExportValidationPrepEnabled,
        fallback.debugTools.importExportValidationPrepEnabled,
      ),
    },
  }
}

const normalizeAccessibilitySettings = (
  value: unknown,
  fallback: AccessibilitySettings,
): AccessibilitySettings => {
  if (!isObject(value)) {
    return fallback
  }
  return {
    largerText: asBoolean(value.largerText, fallback.largerText),
    higherContrast: asBoolean(value.higherContrast, fallback.higherContrast),
    keyboardNavigationPrep: asBoolean(
      value.keyboardNavigationPrep,
      fallback.keyboardNavigationPrep,
    ),
    simplifiedWording: asBoolean(value.simplifiedWording, fallback.simplifiedWording),
  }
}

const normalizeAndroidEcosystemSettings = (
  value: unknown,
  fallback: AndroidEcosystemSettings,
): AndroidEcosystemSettings => {
  if (!isObject(value)) {
    return fallback
  }
  return {
    sharedWorkflowSyncPrep: asBoolean(
      value.sharedWorkflowSyncPrep,
      fallback.sharedWorkflowSyncPrep,
    ),
    sharedNotesTasksSummaryPrep: asBoolean(
      value.sharedNotesTasksSummaryPrep,
      fallback.sharedNotesTasksSummaryPrep,
    ),
    sharedFocusSessionsPrep: asBoolean(
      value.sharedFocusSessionsPrep,
      fallback.sharedFocusSessionsPrep,
    ),
    sharedFamilySeniorSummaryPrep: asBoolean(
      value.sharedFamilySeniorSummaryPrep,
      fallback.sharedFamilySeniorSummaryPrep,
    ),
    aiSafeMemorySyncPreviewPrep: asBoolean(
      value.aiSafeMemorySyncPreviewPrep,
      fallback.aiSafeMemorySyncPreviewPrep,
    ),
  }
}

const normalizeSyncSession = (value: unknown): SyncSession | null => {
  if (!isObject(value)) {
    return null
  }
  const syncSessionId = asString(value.syncSessionId).trim()
  const pairedDeviceId = asString(value.pairedDeviceId).trim()
  if (!syncSessionId || !pairedDeviceId) {
    return null
  }
  return {
    syncSessionId,
    pairedDeviceId,
    syncState:
      value.syncState === 'pairing' ||
      value.syncState === 'ready' ||
      value.syncState === 'syncing' ||
      value.syncState === 'error'
        ? value.syncState
        : 'inactive',
    lastSyncAt:
      typeof value.lastSyncAt === 'string' || value.lastSyncAt === null ? value.lastSyncAt : null,
    pendingChanges: Math.max(0, Math.round(Number(value.pendingChanges) || 0)),
    syncDirection:
      value.syncDirection === 'pc_to_android' || value.syncDirection === 'android_to_pc'
        ? value.syncDirection
        : 'bidirectional',
    syncConflictState:
      value.syncConflictState === 'detected' || value.syncConflictState === 'manual_review'
        ? value.syncConflictState
        : 'none',
    transport:
      value.transport === 'lan' || value.transport === 'tailscale'
        ? value.transport
        : 'localhost_bridge',
    transportAvailable: asBoolean(value.transportAvailable),
    localOnly: true,
  }
}

const normalizeSyncConflict = (value: unknown, index: number): SyncConflictSummary | null => {
  if (!isObject(value)) {
    return null
  }
  const entityId = asString(value.entityId).trim()
  if (!entityId) {
    return null
  }
  return {
    id: asString(value.id, `sync-conflict-${index}`),
    entityType:
      value.entityType === 'task' ||
      value.entityType === 'note' ||
      value.entityType === 'workflow' ||
      value.entityType === 'settings'
        ? value.entityType
        : 'memory',
    entityId,
    localVersion: Math.max(1, Math.round(Number(value.localVersion) || 1)),
    remoteVersion: Math.max(1, Math.round(Number(value.remoteVersion) || 1)),
    lastWriteAtLocal: asString(value.lastWriteAtLocal, new Date().toISOString()),
    lastWriteAtRemote: asString(value.lastWriteAtRemote, new Date().toISOString()),
    summary: asString(value.summary, 'Local conflict requires manual review.'),
    requiresManualResolution: true,
  }
}

const normalizeNotesWorkflow = (
  value: unknown,
  fallback: NotesWorkflowState,
): NotesWorkflowState => {
  if (!isObject(value)) {
    return fallback
  }

  const migratedTaskItems = asArray(value.taskItems)
    .map((item, index) => {
      const normalizedTask = normalizeTaskItem(item, index)
      if (normalizedTask) {
        return normalizedTask
      }

      const checklist = normalizeChecklistItem(item, index)
      if (!checklist) {
        return null
      }

      const stamp = new Date().toISOString()
      return {
        id: checklist.id,
        label: checklist.label,
        completed: checklist.completed,
        dueDate: null,
        priority: 'normal' as const,
        category: 'general',
        pinned: false,
        syncMeta: createDefaultSyncMeta(stamp),
        createdAt: stamp,
        updatedAt: stamp,
      }
    })
    .filter((item): item is TaskItem => item !== null)

  return {
    input: asString(value.input, fallback.input),
    cleanText: asString(value.cleanText, fallback.cleanText),
    shoppingItems: asArray(value.shoppingItems)
      .map((item, index) => normalizeChecklistItem(item, index))
      .filter((item): item is ChecklistItem => item !== null),
    taskItems: migratedTaskItems,
    taskSearch: asString(value.taskSearch, fallback.taskSearch),
    taskFilterStatus: normalizeTaskFilterStatus(value.taskFilterStatus),
    taskFilterCategory: asString(value.taskFilterCategory, fallback.taskFilterCategory),
    template: normalizeTemplate(value.template),
    updatedAt:
      typeof value.updatedAt === 'string' || value.updatedAt === null
        ? value.updatedAt
        : fallback.updatedAt,
  }
}

const normalizeDashboardSectionId = (value: unknown): DashboardSectionId | null => {
  switch (value) {
    case 'summary':
    case 'quick_actions':
    case 'productivity':
    case 'recent_activity':
    case 'pinned_widgets':
      return value
    default:
      return null
  }
}

const normalizeDashboardWidgetId = (value: unknown): DashboardWidgetId | null => {
  switch (value) {
    case 'memory':
    case 'tasks':
    case 'conversations':
    case 'focus':
    case 'health':
      return value
    default:
      return null
  }
}

const normalizeQuickActionId = (value: unknown): QuickActionId | null => {
  switch (value) {
    case 'open_chat':
    case 'health_summary':
    case 'persistent_notes':
    case 'memory_review':
    case 'focus_reset':
    case 'global_search':
      return value
    default:
      return null
  }
}

const normalizeActivityType = (value: unknown): ActivityType => {
  switch (value) {
    case 'memory_saved':
    case 'memory_updated':
    case 'memory_deleted':
    case 'task_completed':
    case 'task_saved':
    case 'conversation_saved':
    case 'conversation_deleted':
    case 'notes_updated':
    case 'settings_saved':
    case 'import_completed':
    case 'export_completed':
    case 'workflow_failed':
    case 'ollama_failed':
    case 'sync_prep_event':
    case 'recovery_event':
      return value
    default:
      return 'notes_updated'
  }
}

const normalizeActivityEntry = (value: unknown, index: number): ActivityEntry | null => {
  if (!isObject(value)) {
    return null
  }

  const title = asString(value.title).trim()
  const detail = asString(value.detail).trim()
  if (!title && !detail) {
    return null
  }

  return {
    id: asString(value.id, `activity-${index}-${Date.now()}`),
    type: normalizeActivityType(value.type),
    title: title || 'Activity',
    detail: detail || 'No detail provided.',
    entityId: asString(value.entityId) || undefined,
    createdAt: asString(value.createdAt, new Date().toISOString()),
  }
}

const normalizeAppData = (value: unknown): AppData => {
  const fallback = cloneDefaultData()

  if (!isObject(value)) {
    return fallback
  }

  const settings = isObject(value.settings) ? value.settings : {}
  const providerSettings = isObject(settings.providerSettings)
    ? settings.providerSettings
    : {}
  const workflows = isObject(value.workflows) ? value.workflows : {}
  const androidBridge = isObject(settings.androidBridge) ? settings.androidBridge : {}
  const sync = isObject(settings.sync) ? settings.sync : {}
  const notifications = isObject(settings.notifications) ? settings.notifications : {}
  const release = isObject(settings.release) ? settings.release : {}
  const security = isObject(settings.security) ? settings.security : {}
  const tester = isObject(settings.tester) ? settings.tester : {}
  const accessibility = isObject(settings.accessibility) ? settings.accessibility : {}
  const androidEcosystem = isObject(settings.androidEcosystem)
    ? settings.androidEcosystem
    : {}
  const localAi = isObject(settings.localAi) ? settings.localAi : {}
  const notesWorkflow = isObject(workflows.notes) ? workflows.notes : {}
  const chatWorkflow = isObject(workflows.chat) ? workflows.chat : {}
  const dashboardWorkflow = isObject(workflows.dashboard) ? workflows.dashboard : {}
  const routinesWorkflow = asArray(workflows.routines)

  const migratedChatHistory = asArray((value as Record<string, unknown>).chatHistory)
    .map((entry, index) => normalizeChatMessage(entry, index))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const normalizedConversations = asArray(chatWorkflow.conversations)
    .map((entry, index) => normalizeConversation(entry, index))
    .filter((entry): entry is Conversation => entry !== null)

  const conversations =
    normalizedConversations.length > 0
      ? normalizedConversations
      : [
          {
            ...fallback.workflows.chat.conversations[0],
            messages: migratedChatHistory,
            updatedAt:
              migratedChatHistory.at(-1)?.createdAt ??
              fallback.workflows.chat.conversations[0].updatedAt,
          },
        ]

  const activeConversationId = asString(chatWorkflow.activeConversationId)
  const safeActiveConversationId =
    conversations.some((conversation) => conversation.id === activeConversationId)
      ? activeConversationId
      : conversations[0]?.id ?? null

  return {
    memory: asArray(value.memory)
      .map((entry, index) => normalizeMemoryEntry(entry, index))
      .filter((entry): entry is MemoryEntry => entry !== null),
    settings: {
      localFirst: asBoolean(settings.localFirst, fallback.settings.localFirst),
      providerSettings: {
        preferredProvider: normalizeProviderId(providerSettings.preferredProvider),
        ollamaUrl: asString(
          providerSettings.ollamaUrl,
          fallback.settings.providerSettings.ollamaUrl,
        ),
        ollamaModel: asString(
          providerSettings.ollamaModel,
          fallback.settings.providerSettings.ollamaModel,
        ),
        openAiApiKey: asString(
          providerSettings.openAiApiKey,
          fallback.settings.providerSettings.openAiApiKey,
        ),
        geminiApiKey: asString(
          providerSettings.geminiApiKey,
          fallback.settings.providerSettings.geminiApiKey,
        ),
        claudeApiKey: asString(
          providerSettings.claudeApiKey,
          fallback.settings.providerSettings.claudeApiKey,
        ),
      },
      uiPreferences: normalizeUiPreferences(
        settings.uiPreferences,
        fallback.settings.uiPreferences,
      ),
      helperPreferences: normalizeHelperPreferences(
        settings.helperPreferences,
        fallback.settings.helperPreferences,
      ),
      remoteAccess: normalizeRemoteAccessSettings(
        settings.remoteAccess,
        fallback.settings.remoteAccess,
      ),
      androidBridge: normalizeAndroidBridgeSettings(
        androidBridge,
        fallback.settings.androidBridge,
      ),
      sync: normalizeSyncSettings(sync, fallback.settings.sync),
      notifications: {
        enabled: asBoolean(notifications.enabled, fallback.settings.notifications.enabled),
        desktopNotificationPrep: asBoolean(
          notifications.desktopNotificationPrep,
          fallback.settings.notifications.desktopNotificationPrep,
        ),
        browserNotificationFallback:
          notifications.browserNotificationFallback === 'disabled'
            ? 'disabled'
            : 'manual_prompt_only',
        reminders: asArray(notifications.reminders)
          .map((entry, index) => normalizeReminderItem(entry, index))
          .filter((entry): entry is ReminderItem => entry !== null),
      },
      release: normalizeReleaseSettings(release, fallback.settings.release),
      security: normalizeSecuritySettings(security, fallback.settings.security),
      tester: normalizeTesterSettings(tester, fallback.settings.tester),
      accessibility: normalizeAccessibilitySettings(
        accessibility,
        fallback.settings.accessibility,
      ),
      androidEcosystem: normalizeAndroidEcosystemSettings(
        androidEcosystem,
        fallback.settings.androidEcosystem,
      ),
      localAi: normalizeLocalAiSettings(localAi, fallback.settings.localAi),
    },
    workflows: {
      notes: normalizeNotesWorkflow(notesWorkflow, fallback.workflows.notes),
      chat: {
        conversations,
        activeConversationId: safeActiveConversationId,
      },
      dashboard: {
        collapsedSections: asArray(dashboardWorkflow.collapsedSections)
          .map((item) => normalizeDashboardSectionId(item))
          .filter((item): item is DashboardSectionId => item !== null),
        pinnedWidgets: asArray(dashboardWorkflow.pinnedWidgets)
          .map((item) => normalizeDashboardWidgetId(item))
          .filter((item): item is DashboardWidgetId => item !== null),
        quickActionIds: asArray(dashboardWorkflow.quickActionIds)
          .map((item) => normalizeQuickActionId(item))
          .filter((item): item is QuickActionId => item !== null),
      },
      syncSessions: asArray(workflows.syncSessions)
        .map((entry) => normalizeSyncSession(entry))
        .filter((entry): entry is SyncSession => entry !== null),
      syncConflicts: asArray(workflows.syncConflicts)
        .map((entry, index) => normalizeSyncConflict(entry, index))
        .filter((entry): entry is SyncConflictSummary => entry !== null),
      routines: (() => {
        const normalized = routinesWorkflow
          .map((entry, index) =>
            normalizeWorkflowRoutine(entry, index, fallback.workflows.routines),
          )
          .filter((entry): entry is WorkflowRoutine => entry !== null)
        return normalized.length > 0 ? normalized : fallback.workflows.routines
      })(),
      reminders: asArray(workflows.reminders)
        .map((entry, index) => normalizeReminderItem(entry, index))
        .filter((entry): entry is ReminderItem => entry !== null),
      routineRuntime: normalizeWorkflowRuntime(
        workflows.routineRuntime,
        fallback.workflows.routineRuntime,
      ),
      activityLog: asArray(workflows.activityLog)
        .map((entry, index) => normalizeActivityEntry(entry, index))
        .filter((entry): entry is ActivityEntry => entry !== null)
        .slice(0, 100),
    },
  }
}

const readFallbackStorage = () => {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return cloneDefaultData()
    }

    return normalizeAppData(JSON.parse(raw) as unknown)
  } catch {
    return cloneDefaultData()
  }
}

const resolveRuntimeStorageMode = async (
  force = false,
): Promise<BrowserStorageRuntimeMode> => {
  if (window.godzillaAPI) {
    bridgeProbeState.mode = 'electron_local_file'
    bridgeProbeState.bridgeAvailable = false
    bridgeProbeState.message = 'Using Electron local file storage.'
    return bridgeProbeState.mode
  }

  const now = Date.now()
  if (!force && now - bridgeProbeState.checkedAt < 5000) {
    return bridgeProbeState.mode
  }

  bridgeProbeState.checkedAt = now
  try {
    const response = await fetch('/api/bridge/status', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const payload = (await response.json()) as unknown
    if (!isObject(payload) || payload.ok !== true || payload.bridgeAvailable !== true) {
      throw new Error('Bridge unavailable')
    }
    const bridgeInfo = payload as BridgeStatusResponse
    bridgeProbeState.mode = 'remote_pc_host'
    bridgeProbeState.bridgeAvailable = true
    bridgeProbeState.message = `Connected to PC host storage over private network (${bridgeInfo.hostMode}).`
    return bridgeProbeState.mode
  } catch {
    bridgeProbeState.mode = 'browser_local_storage'
    bridgeProbeState.bridgeAvailable = false
    bridgeProbeState.message = 'Using this browser local storage only.'
    return bridgeProbeState.mode
  }
}

export const loadAppData = async (): Promise<AppData> => {
  if (window.godzillaAPI) {
    try {
      return normalizeAppData(await window.godzillaAPI.loadAppData())
    } catch {
      return readFallbackStorage()
    }
  }

  if ((await resolveRuntimeStorageMode(true)) === 'remote_pc_host') {
    try {
      const response = await fetch('/api/app-data', {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const payload = (await response.json()) as unknown
      if (!isObject(payload) || !('ok' in payload) || payload.ok !== true) {
        throw new Error('Bridge payload invalid')
      }
      const parsedData = isObject(payload) && 'data' in payload ? payload.data : payload
      bridgeProbeState.loadedHostDataAtLeastOnce = true
      return normalizeAppData(parsedData)
    } catch {
      // Fall through to safe browser storage.
    }
  }

  try {
    const raw = window.localStorage.getItem(storageKey)

    if (!raw) {
      return cloneDefaultData()
    }

    const parsed = JSON.parse(raw) as unknown
    return normalizeAppData(parsed)
  } catch {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        window.localStorage.setItem(corruptStorageKey, raw)
      }
    } catch {
      return cloneDefaultData()
    }

    return cloneDefaultData()
  }
}

export const saveAppData = async (data: AppData): Promise<AppData> => {
  const normalized = normalizeAppData(data)

  if (window.godzillaAPI) {
    try {
      return normalizeAppData(await window.godzillaAPI.saveAppData(normalized))
    } catch {
      window.localStorage.setItem(storageKey, JSON.stringify(normalized))
      return normalized
    }
  }

  if ((await resolveRuntimeStorageMode()) === 'remote_pc_host') {
    if (!bridgeProbeState.loadedHostDataAtLeastOnce) {
      // Guard against accidentally overwriting host data before initial host load.
      window.localStorage.setItem(storageKey, JSON.stringify(normalized))
      return normalized
    }
    try {
      const response = await fetch('/api/app-data', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ data: normalized }),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const payload = (await response.json()) as unknown
      if (!isObject(payload) || payload.ok !== true) {
        throw new Error('Bridge save payload invalid')
      }
      const savedData = isObject(payload) && 'data' in payload ? payload.data : normalized
      return normalizeAppData(savedData)
    } catch (error) {
      console.warn(
        '[GodzillaModeAI] Remote PC host save failed; using browser local storage fallback.',
        error instanceof Error ? error.message : 'unknown error',
      )
      window.localStorage.setItem(storageKey, JSON.stringify(normalized))
      return normalized
    }
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalized))
  return normalized
}

export const getAppInfo = async (): Promise<AppInfo> => {
  if (window.godzillaAPI) {
    try {
      return window.godzillaAPI.getAppInfo()
    } catch {
      return {
        ...defaultAppInfo,
        chromeVersion: navigator.userAgent,
        environmentStatus: window.godzillaAPI ? 'desktop_shell' : 'browser_fallback',
      }
    }
  }

  const mode = await resolveRuntimeStorageMode()
  if (mode === 'remote_pc_host') {
    return {
      ...defaultAppInfo,
      chromeVersion: navigator.userAgent,
      environmentStatus: 'browser_fallback',
      dataFilePath: 'remote-pc-host-storage',
      dataDirectoryPath: 'private-network-host',
      packagingTarget: 'desktop_dev',
    }
  }

  return {
    ...defaultAppInfo,
    chromeVersion: navigator.userAgent,
    environmentStatus: 'browser_fallback',
  }
}

export const getNetworkStatus = async (): Promise<NetworkStatus> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.getNetworkStatus()
    } catch {
      // Fall back to safe local values below.
    }
  }

  return {
    localhostStatus: 'online',
    localNetworkIp: null,
    tailscaleDetected: false,
    tailscaleRunning: false,
    tailscaleIp: null,
    readinessStatus: 'local_only',
    checkedAt: new Date().toISOString(),
    notes: ['Desktop network diagnostics are only available in the Electron shell.'],
  }
}

export const startPrivateBrowserAccess = async (
  config: PrivateBrowserAccessConfig,
): Promise<PrivateBrowserAccessStatus> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.startPrivateBrowserAccess(config)
    } catch {
      // Fall through to safe browser fallback.
    }
  }

  return {
    status: 'failed',
    available: false,
    host: '127.0.0.1',
    port: config.browserPort,
    localhostUrl: null,
    lanUrl: null,
    tailscaleUrl: null,
    message: 'Private browser access controls require the desktop shell.',
  }
}

export const stopPrivateBrowserAccess = async (): Promise<PrivateBrowserAccessStatus> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.stopPrivateBrowserAccess()
    } catch {
      // Fall through to safe browser fallback.
    }
  }

  return {
    status: 'stopped',
    available: false,
    host: '127.0.0.1',
    port: 4173,
    localhostUrl: null,
    lanUrl: null,
    tailscaleUrl: null,
    message: 'Private browser access controls are unavailable in browser fallback mode.',
  }
}

export const getPrivateBrowserAccessStatus = async (): Promise<PrivateBrowserAccessStatus> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.getPrivateBrowserAccessStatus()
    } catch {
      // Fall through to safe browser fallback.
    }
  }

  return {
    status: 'stopped',
    available: false,
    host: '127.0.0.1',
    port: 4173,
    localhostUrl: null,
    lanUrl: null,
    tailscaleUrl: null,
    message: 'Private browser access controls are unavailable in browser fallback mode.',
  }
}

export const copyText = async (text: string) => {
  if (window.godzillaAPI) {
    try {
      return window.godzillaAPI.copyText(text)
    } catch {
      // Fall back to browser clipboard below.
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const openDataFolder = async () => {
  if (window.godzillaAPI) {
    try {
      return window.godzillaAPI.openDataFolder()
    } catch {
      return false
    }
  }

  return false
}

export const getOllamaStatus = async (
  url: string,
  selectedModel: string,
): Promise<OllamaStatus> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.getOllamaStatus(url, selectedModel)
    } catch {
      // Fall through to safe browser fallback.
    }
  }

  return {
    available: false,
    url,
    models: [],
    selectedModelAvailable: false,
    selectedModel,
    message: 'Desktop shell required for local Ollama bridge.',
    checkedAt: new Date().toISOString(),
    desktopBridgeRequired: true,
  }
}

export const checkOllamaStatus = async (baseUrl: string): Promise<OllamaCheckResponse> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.checkOllamaStatus(baseUrl)
    } catch {
      // Fall through to safe browser fallback.
    }
  }

  return {
    status: 'unavailable',
    baseUrl,
    reachable: false,
    message: 'Desktop shell required for local Ollama checks.',
    checkedAt: new Date().toISOString(),
    errorMessage: 'Desktop shell required for local Ollama checks.',
  }
}

export const listOllamaModels = async (baseUrl: string): Promise<OllamaModelsResponse> => {
  if (window.godzillaAPI) {
    try {
      return await window.godzillaAPI.listOllamaModels(baseUrl)
    } catch {
      // Fall through to safe browser fallback.
    }
  }

  return {
    status: 'unavailable',
    baseUrl,
    models: [],
    message: 'Desktop shell required for local Ollama checks.',
    checkedAt: new Date().toISOString(),
    errorMessage: 'Desktop shell required for local Ollama checks.',
  }
}

export const generateWithOllama = async (
  baseUrl: string,
  model: string,
  prompt: string,
): Promise<OllamaGenerateResponse> => {
  console.info(
    '[GodzillaModeAI] Renderer stage: ollama_invoke_started',
    JSON.stringify({
      baseUrl,
      model,
      promptLength: prompt.length,
      hasDesktopBridge: Boolean(window.godzillaAPI),
    }),
  )
  if (window.godzillaAPI) {
    try {
      const result = await window.godzillaAPI.generateWithOllama(baseUrl, model, prompt)
      console.info(
        '[GodzillaModeAI] Renderer stage: ollama_invoke_completed',
        JSON.stringify({
          ok: result.ok,
          message: result.message,
          errorMessage: result.errorMessage ?? '',
          textLength: result.text.length,
        }),
      )
      return result
    } catch {
      console.warn('[GodzillaModeAI] Renderer stage: ollama_invoke_exception')
      // Fall through to safe browser fallback.
    }
  }

  return {
    ok: false,
    text: '',
    model,
    baseUrl,
    message: 'Desktop shell required for Ollama generation.',
    errorMessage: 'Desktop shell required for Ollama generation.',
  }
}
