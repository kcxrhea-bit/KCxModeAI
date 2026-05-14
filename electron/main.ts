import * as electron from 'electron'
import { execFile as execFileCallback } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import * as http from 'node:http'
import * as https from 'node:https'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

type StoredAppData = Record<string, unknown>
type StoredChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  response?: Record<string, unknown>
}
type StoredConversation = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  messages: StoredChatMessage[]
}
type StoredNetworkStatus = {
  localhostStatus: 'online' | 'offline'
  localNetworkIp: string | null
  tailscaleDetected: boolean
  tailscaleRunning: boolean
  tailscaleIp: string | null
  readinessStatus: 'local_only' | 'hybrid_ready' | 'remote_ready_partial'
  checkedAt: string
  notes: string[]
}
type PrivateBrowserAccessMode = 'localhost_only' | 'lan' | 'tailscale'
type PrivateBrowserAccessStatus = {
  status: 'stopped' | 'starting' | 'running' | 'failed'
  available: boolean
  host: string
  port: number
  localhostUrl: string | null
  lanUrl: string | null
  tailscaleUrl: string | null
  message: string
}
type PrivateBridgeStatusResponse = {
  ok: true
  hostMode: PrivateBrowserAccessMode
  appName: string
  version: string
  bridgeAvailable: true
  localOnly: true
  checkedAt: string
}

const execFile = promisify(execFileCallback)
const electronApi = (
  (electron as unknown as { default?: typeof electron }).default ?? electron
) as typeof electron
const { app, BrowserWindow, clipboard, ipcMain, shell } = electronApi

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const defaultAppData = (): StoredAppData => ({
  memory: [],
  settings: {
    localFirst: true,
    providerSettings: {
      preferredProvider: 'rule-based',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: '',
      openAiApiKey: '',
      geminiApiKey: '',
      claudeApiKey: '',
    },
    uiPreferences: {
      themePreference: 'godzilla',
      sidebarCollapsed: false,
      lastView: 'dashboard',
      memorySearch: '',
      memoryCategoryFilter: 'all',
      memoryPinnedOnly: false,
      memoryTagFilter: '',
      memoryArchivedOnly: false,
      memorySortOrder: 'newest',
      notesActiveTab: 'clean',
    },
    helperPreferences: {
      notesRememberDrafts: true,
      focusPreset: 'quick_reset',
      focusTimerMinutes: 25,
      familyTemplate: 'calm_boundary',
      seniorEasyMode: false,
    },
    remoteAccess: {
      mode: 'local_only',
      tailscaleEnabled: false,
      remoteSyncPlanned: false,
      remoteApiBridgeEnabled: false,
      remoteAiRequestsEnabled: false,
      androidCompanionPlanned: true,
      browserAccessEnabled: false,
      browserHostMode: 'localhost_only',
      browserBindHost: '127.0.0.1',
      browserPort: 4173,
      localAccessPin: '',
      trustedNetworkLabel: 'Home LAN / Tailscale private mesh',
    },
    androidBridge: {
      enabled: false,
      localBridgePort: 43117,
      bridgeMode: 'off',
      pairingCode: '',
      allowedDevices: [],
      pairedDevices: [],
      lastSeenAt: null,
      syncPreviewLastCheckedAt: null,
      syncPairingPlaceholder: 'Prepared for future local pairing. Not active yet.',
    },
    sync: {
      allowLanSyncPrep: true,
      allowLocalhostBridgePrep: true,
      allowTailscaleSyncPrep: false,
      trustedDevicePlaceholders: [],
      pairingRequest: {
        requestId: '',
        status: 'idle',
        requestedAt: null,
        expiresAt: null,
      },
      lastSyncSessionId: null,
    },
    notifications: {
      enabled: false,
      desktopNotificationPrep: true,
      browserNotificationFallback: 'manual_prompt_only',
      reminders: [],
    },
    release: {
      buildChannel: 'development',
      releaseType: 'dev_snapshot',
      environmentStatus: 'browser_fallback',
      packagingPrep: {
        installerReadyPlaceholder: false,
        portableModeReadyPlaceholder: false,
        optionalUpdaterPlanned: true,
      },
    },
    security: {
      encryptionPrep: {
        encryptedLocalExportPlanned: true,
        encryptedSyncPayloadPlanned: true,
        encryptedMemoryCategoriesPlanned: true,
        securePairingPlanned: true,
      },
      partitioning: {
        healthSensitiveCategories: ['health_context', 'blood_sugar', 'medicine', 'symptom'],
        familySeniorSensitiveCategories: ['safe_note', 'user_preference'],
        localAiSafeOnlyVisibility: false,
        exportSafeOnlyVisibility: false,
        syncEligibleOnlyVisibility: false,
      },
      localOnlyIndicatorsEnabled: true,
    },
    tester: {
      feedback: {
        testerNotes: '',
        bugReportDraft: '',
        localFeedbackQueue: [],
      },
      debugTools: {
        compactResetPrepEnabled: true,
        safeCacheClearPrepEnabled: true,
        workflowResetPrepEnabled: true,
        importExportValidationPrepEnabled: true,
      },
    },
    accessibility: {
      largerText: false,
      higherContrast: false,
      keyboardNavigationPrep: true,
      simplifiedWording: false,
    },
    androidEcosystem: {
      sharedWorkflowSyncPrep: true,
      sharedNotesTasksSummaryPrep: true,
      sharedFocusSessionsPrep: true,
      sharedFamilySeniorSummaryPrep: true,
      aiSafeMemorySyncPreviewPrep: true,
    },
    localAi: {
      providerMode: 'rule_based',
      ollama: {
        enabled: false,
        baseUrl: 'http://localhost:11434',
        selectedModel: '',
        availableModels: [],
        lastStatus: 'unavailable',
        lastCheckedAt: null,
        errorMessage: '',
      },
      context: {
        contextMode: 'minimal',
        maxContextMessages: 6,
        allowConversationTitles: false,
        allowTaskContext: false,
        allowNotesContext: false,
        allowMemoryHighlights: false,
      },
    },
  },
  workflows: {
    notes: {
      input: '',
      cleanText: '',
      shoppingItems: [],
      taskItems: [],
      taskSearch: '',
      taskFilterStatus: 'all',
      taskFilterCategory: 'all',
      template: 'blank',
      updatedAt: null,
    },
    chat: {
      conversations: [
        {
          id: 'main-chat',
          title: 'Main Chat',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          pinned: false,
          messages: [],
        },
      ],
      activeConversationId: 'main-chat',
    },
    dashboard: {
      collapsedSections: [],
      pinnedWidgets: ['memory', 'tasks', 'conversations'],
      quickActionIds: [
        'open_chat',
        'health_summary',
        'persistent_notes',
        'memory_review',
      ],
    },
    syncSessions: [],
    syncConflicts: [],
    routines: [
      {
        id: 'routine-morning',
        name: 'Morning Routine',
        description: 'Start the day with focus and planning steps.',
        category: 'morning_routine',
        trigger: 'manual',
        enabled: true,
        status: 'idle',
        lastRunAt: null,
        steps: [
          { id: 'morning-1', title: 'Review top tasks', detail: 'Check your highest-priority tasks for today.', type: 'review' },
          { id: 'morning-2', title: 'Set first focus block', detail: 'Pick one important task to start with.', type: 'prompt' },
        ],
      },
      {
        id: 'routine-focus',
        name: 'Focus Session',
        description: 'Run a clean local focus block flow.',
        category: 'focus_session',
        trigger: 'manual',
        enabled: true,
        status: 'idle',
        lastRunAt: null,
        steps: [
          { id: 'focus-1', title: 'Choose one task', detail: 'Commit to a single outcome for this block.', type: 'prompt' },
        ],
      },
      {
        id: 'routine-planning',
        name: 'Daily Planning',
        description: 'Prepare a realistic plan for today.',
        category: 'daily_planning',
        trigger: 'manual',
        enabled: true,
        status: 'idle',
        lastRunAt: null,
        steps: [{ id: 'planning-1', title: 'Pick top 3 outcomes', detail: 'Choose what must get done today.', type: 'prompt' }],
      },
      {
        id: 'routine-winddown',
        name: 'Wind Down',
        description: 'Close the day and reduce carry-over stress.',
        category: 'wind_down',
        trigger: 'manual',
        enabled: true,
        status: 'idle',
        lastRunAt: null,
        steps: [{ id: 'winddown-1', title: 'Capture unfinished items', detail: 'Move loose tasks into tomorrow.', type: 'review' }],
      },
      {
        id: 'routine-notes',
        name: 'Notes Cleanup',
        description: 'Review and clean notes workflow output.',
        category: 'notes_cleanup',
        trigger: 'manual',
        enabled: true,
        status: 'idle',
        lastRunAt: null,
        steps: [{ id: 'notes-1', title: 'Run notes helper', detail: 'Clean raw notes into structured sections.', type: 'review' }],
      },
    ],
    reminders: [],
    routineRuntime: {
      activeRoutineId: null,
      status: 'idle',
      message: 'No workflow run yet.',
      updatedAt: null,
    },
    activityLog: [],
  },
})

const dataFilePath = () =>
  path.join(app.getPath('userData'), 'godzillamodeai.local-data.json')

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const asBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

const asArray = (value: unknown) => (Array.isArray(value) ? value : [])
const createDefaultSyncMeta = (stamp = new Date().toISOString()) => ({
  lastModified: stamp,
  syncEligible: true,
  syncVersion: 1,
  deviceSource: 'desktop_local',
  pendingSync: false,
  localOnly: true,
})

const normalizeProviderId = (value: unknown) =>
  value === 'ollama' ? 'ollama' : 'rule-based'

const normalizeChecklistItem = (value: unknown, index: number) => {
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

const normalizeTaskItem = (value: unknown, index: number) => {
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
        deviceSource:
          value.syncMeta.deviceSource === 'android_future' ||
          value.syncMeta.deviceSource === 'unknown'
            ? value.syncMeta.deviceSource
            : 'desktop_local',
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
    priority:
      value.priority === 'low' || value.priority === 'high' ? value.priority : 'normal',
    category: asString(value.category, 'general'),
    pinned: asBoolean(value.pinned),
    syncMeta,
    createdAt: asString(value.createdAt, stamp),
    updatedAt: asString(value.updatedAt, stamp),
  }
}

const normalizeChatMessage = (value: unknown, index: number): StoredChatMessage | null => {
  if (!isObject(value)) {
    return null
  }

  const role = value.role === 'assistant' ? 'assistant' : value.role === 'user' ? 'user' : null
  const content = asString(value.content).trim()

  if (!role || !content) {
    return null
  }

  const message: StoredChatMessage = {
    id: asString(value.id, `chat-${index}-${Date.now()}`),
    role,
    content,
    createdAt: asString(value.createdAt, new Date().toISOString()),
  }

  if (isObject(value.response)) {
    message.response = {
      type: asString(value.response.type, 'general'),
      title: asString(value.response.title, 'Local Assistant Response'),
      responseText: asString(value.response.responseText, content),
      bullets: asArray(value.response.bullets).map((item) => asString(item)).filter(Boolean),
      suggestedActions: asArray(value.response.suggestedActions)
        .map((item) => asString(item))
        .filter(Boolean),
      safetyLevel:
        value.response.safetyLevel === 'caution' ||
        value.response.safetyLevel === 'urgent' ||
        value.response.safetyLevel === 'info'
          ? value.response.safetyLevel
          : 'normal',
      memoryUpdates: asArray(value.response.memoryUpdates)
        .map((item) => asString(item))
        .filter(Boolean),
    }
  }

  return message
}

const normalizeConversation = (value: unknown, index: number): StoredConversation | null => {
  if (!isObject(value)) {
    return null
  }

  const title = asString(value.title).trim()
  const createdAt = asString(value.createdAt, new Date().toISOString())

  return {
    id: asString(value.id, `conversation-${index}-${Date.now()}`),
    title: title || `Conversation ${index + 1}`,
    createdAt,
    updatedAt: asString(value.updatedAt, createdAt),
    pinned: asBoolean(value.pinned),
    messages: asArray(value.messages)
      .map((entry, messageIndex) => normalizeChatMessage(entry, messageIndex))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  }
}

const normalizeMemoryEntry = (value: unknown, index: number) => {
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
        deviceSource:
          value.syncMeta.deviceSource === 'android_future' ||
          value.syncMeta.deviceSource === 'unknown'
            ? value.syncMeta.deviceSource
            : 'desktop_local',
        pendingSync: asBoolean(value.syncMeta.pendingSync),
        localOnly: asBoolean(value.syncMeta.localOnly, true),
      }
    : createDefaultSyncMeta(stamp)

  return {
    id: asString(value.id, `memory-${index}-${Date.now()}`),
    category: asString(value.category, 'note'),
    title: title || 'Untitled Memory',
    content: content || 'No content saved.',
    source: asString(value.source, 'unknown'),
    tags: asArray(value.tags).map((item) => asString(item)).filter(Boolean).slice(0, 12),
    pinned: asBoolean(value.pinned),
    favorite: asBoolean(value.favorite),
    importance:
      value.importance === 'low' ||
      value.importance === 'important' ||
      value.importance === 'high'
        ? value.importance
        : 'normal',
    safeForLocalAi: asBoolean(value.safeForLocalAi),
    archived: asBoolean(value.archived),
    syncMeta,
    createdAt: asString(value.createdAt, stamp),
    updatedAt: asString(value.updatedAt, stamp),
  }
}

const normalizeActivityEntry = (value: unknown, index: number) => {
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
    type: asString(value.type, 'notes_updated'),
    title: title || 'Activity',
    detail: detail || 'No detail provided.',
    entityId: asString(value.entityId) || undefined,
    createdAt: asString(value.createdAt, new Date().toISOString()),
  }
}

const normalizeData = (value: unknown): StoredAppData => {
  const fallback = defaultAppData()
  const fallbackConversation: StoredConversation = {
    id: 'main-chat',
    title: 'Main Chat',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pinned: false,
    messages: [],
  }

  if (!isObject(value)) {
    return fallback
  }

  const settings = isObject(value.settings) ? value.settings : {}
  const providerSettings = isObject(settings.providerSettings)
    ? settings.providerSettings
    : {}
  const remoteAccess = isObject(settings.remoteAccess) ? settings.remoteAccess : {}
  const androidBridge = isObject(settings.androidBridge) ? settings.androidBridge : {}
  const sync = isObject(settings.sync) ? settings.sync : {}
  const notifications = isObject(settings.notifications) ? settings.notifications : {}
  const release = isObject(settings.release) ? settings.release : {}
  const security = isObject(settings.security) ? settings.security : {}
  const tester = isObject(settings.tester) ? settings.tester : {}
  const accessibility = isObject(settings.accessibility) ? settings.accessibility : {}
  const androidEcosystem = isObject(settings.androidEcosystem) ? settings.androidEcosystem : {}
  const localAi = isObject(settings.localAi) ? settings.localAi : {}
  const uiPreferences = isObject(settings.uiPreferences) ? settings.uiPreferences : {}
  const helperPreferences = isObject(settings.helperPreferences)
    ? settings.helperPreferences
    : {}
  const workflows = isObject(value.workflows) ? value.workflows : {}
  const notes = isObject(workflows.notes) ? workflows.notes : {}
  const chat = isObject(workflows.chat) ? workflows.chat : {}
  const dashboard = isObject(workflows.dashboard) ? workflows.dashboard : {}

  const migratedChatHistory = asArray(value.chatHistory)
    .map((entry, index) => normalizeChatMessage(entry, index))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const conversations = asArray(chat.conversations)
    .map((entry, index) => normalizeConversation(entry, index))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const safeConversations: StoredConversation[] =
    conversations.length > 0
      ? conversations
      : [
          {
            ...fallbackConversation,
            messages: migratedChatHistory,
            updatedAt:
              migratedChatHistory.at(-1)?.createdAt ?? fallbackConversation.updatedAt,
          },
        ]

  const activeConversationId = asString(chat.activeConversationId)
  const safeActiveConversationId = safeConversations.some(
    (conversation) => conversation.id === activeConversationId,
  )
    ? activeConversationId
    : safeConversations[0]?.id

  return {
    memory: asArray(value.memory)
      .map((entry, index) => normalizeMemoryEntry(entry, index))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    settings: {
      localFirst: asBoolean(settings.localFirst, true),
      providerSettings: {
        preferredProvider: normalizeProviderId(providerSettings.preferredProvider),
        ollamaUrl: asString(providerSettings.ollamaUrl, 'http://localhost:11434'),
        ollamaModel: asString(providerSettings.ollamaModel),
        openAiApiKey: asString(providerSettings.openAiApiKey),
        geminiApiKey: asString(providerSettings.geminiApiKey),
        claudeApiKey: asString(providerSettings.claudeApiKey),
      },
      uiPreferences: {
        themePreference: asString(uiPreferences.themePreference, 'godzilla'),
        sidebarCollapsed: asBoolean(uiPreferences.sidebarCollapsed),
        lastView: asString(uiPreferences.lastView, 'dashboard'),
        memorySearch: asString(uiPreferences.memorySearch),
        memoryCategoryFilter: asString(uiPreferences.memoryCategoryFilter, 'all'),
        memoryPinnedOnly: asBoolean(uiPreferences.memoryPinnedOnly),
        memoryTagFilter: asString(uiPreferences.memoryTagFilter),
        memoryArchivedOnly: asBoolean(uiPreferences.memoryArchivedOnly),
        memorySortOrder: asString(uiPreferences.memorySortOrder, 'newest'),
        notesActiveTab: asString(uiPreferences.notesActiveTab, 'clean'),
      },
      helperPreferences: {
        notesRememberDrafts: asBoolean(helperPreferences.notesRememberDrafts, true),
        focusPreset:
          helperPreferences.focusPreset === 'deep_work' ||
          helperPreferences.focusPreset === 'reentry'
            ? helperPreferences.focusPreset
            : 'quick_reset',
        focusTimerMinutes: (() => {
          const parsed = Number(helperPreferences.focusTimerMinutes)
          return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), 5), 120) : 25
        })(),
        familyTemplate:
          helperPreferences.familyTemplate === 'routine_reset' ||
          helperPreferences.familyTemplate === 'screen_time'
            ? helperPreferences.familyTemplate
            : 'calm_boundary',
        seniorEasyMode: asBoolean(helperPreferences.seniorEasyMode, false),
      },
      remoteAccess: {
        mode: remoteAccess.mode === 'hybrid_ready' ? 'hybrid_ready' : 'local_only',
        tailscaleEnabled: asBoolean(remoteAccess.tailscaleEnabled),
        remoteSyncPlanned: asBoolean(remoteAccess.remoteSyncPlanned),
        remoteApiBridgeEnabled: asBoolean(remoteAccess.remoteApiBridgeEnabled),
        remoteAiRequestsEnabled: asBoolean(remoteAccess.remoteAiRequestsEnabled),
        androidCompanionPlanned: asBoolean(remoteAccess.androidCompanionPlanned, true),
        browserAccessEnabled: asBoolean(remoteAccess.browserAccessEnabled, false),
        browserHostMode:
          remoteAccess.browserHostMode === 'lan' ||
          remoteAccess.browserHostMode === 'tailscale'
            ? remoteAccess.browserHostMode
            : 'localhost_only',
        browserBindHost: asString(remoteAccess.browserBindHost, '127.0.0.1'),
        browserPort: (() => {
          const parsed = Number(remoteAccess.browserPort)
          return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535
            ? Math.round(parsed)
            : 4173
        })(),
        localAccessPin: asString(remoteAccess.localAccessPin),
        trustedNetworkLabel: asString(
          remoteAccess.trustedNetworkLabel,
          'Home LAN / Tailscale private mesh',
        ),
      },
      androidBridge: {
        enabled: asBoolean(androidBridge.enabled),
        localBridgePort: (() => {
          const parsed = Number(androidBridge.localBridgePort)
          return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535
            ? Math.round(parsed)
            : 43117
        })(),
        bridgeMode:
          androidBridge.bridgeMode === 'local_only' ||
          androidBridge.bridgeMode === 'tailscale_ready'
            ? androidBridge.bridgeMode
            : 'off',
        pairingCode: asString(androidBridge.pairingCode),
        allowedDevices: asArray(androidBridge.allowedDevices)
          .map((entry, index) => {
            if (!isObject(entry)) {
              return null
            }
            const label = asString(entry.label).trim()
            if (!label) {
              return null
            }
            return {
              id: asString(entry.id, `device-${index}`).trim(),
              label,
            }
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        pairedDevices: asArray(androidBridge.pairedDevices)
          .map((entry, index) => {
            if (!isObject(entry)) {
              return null
            }
            const label = asString(entry.label).trim()
            if (!label) {
              return null
            }
            return {
              id: asString(entry.id, `paired-device-${index}`).trim(),
              label,
              lastSeenAt:
                typeof entry.lastSeenAt === 'string' || entry.lastSeenAt === null
                  ? entry.lastSeenAt
                  : null,
            }
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        lastSeenAt:
          typeof androidBridge.lastSeenAt === 'string' || androidBridge.lastSeenAt === null
            ? androidBridge.lastSeenAt
            : null,
        syncPreviewLastCheckedAt:
          typeof androidBridge.syncPreviewLastCheckedAt === 'string' ||
          androidBridge.syncPreviewLastCheckedAt === null
            ? androidBridge.syncPreviewLastCheckedAt
            : null,
        syncPairingPlaceholder: asString(
          androidBridge.syncPairingPlaceholder,
          'Prepared for future local pairing. Not active yet.',
        ),
      },
      sync: {
        allowLanSyncPrep: asBoolean(sync.allowLanSyncPrep, true),
        allowLocalhostBridgePrep: asBoolean(sync.allowLocalhostBridgePrep, true),
        allowTailscaleSyncPrep: asBoolean(sync.allowTailscaleSyncPrep, false),
        trustedDevicePlaceholders: asArray(sync.trustedDevicePlaceholders)
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
        pairingRequest: isObject(sync.pairingRequest)
          ? {
              requestId: asString(sync.pairingRequest.requestId),
              status:
                sync.pairingRequest.status === 'pending' ||
                sync.pairingRequest.status === 'accepted' ||
                sync.pairingRequest.status === 'rejected' ||
                sync.pairingRequest.status === 'revoked'
                  ? sync.pairingRequest.status
                  : 'idle',
              requestedAt:
                typeof sync.pairingRequest.requestedAt === 'string' ||
                sync.pairingRequest.requestedAt === null
                  ? sync.pairingRequest.requestedAt
                  : null,
              expiresAt:
                typeof sync.pairingRequest.expiresAt === 'string' ||
                sync.pairingRequest.expiresAt === null
                  ? sync.pairingRequest.expiresAt
                  : null,
            }
          : {
              requestId: '',
              status: 'idle',
              requestedAt: null,
              expiresAt: null,
            },
        lastSyncSessionId: asString(sync.lastSyncSessionId) || null,
      },
      notifications: {
        enabled: asBoolean(notifications.enabled, false),
        desktopNotificationPrep: asBoolean(notifications.desktopNotificationPrep, true),
        browserNotificationFallback:
          notifications.browserNotificationFallback === 'disabled'
            ? 'disabled'
            : 'manual_prompt_only',
        reminders: asArray(notifications.reminders)
          .map((entry, index) => {
            if (!isObject(entry)) {
              return null
            }
            const title = asString(entry.title).trim()
            const remindAt = asString(entry.remindAt).trim()
            if (!title || !remindAt) {
              return null
            }
            return {
              id: asString(entry.id, `reminder-${index}`),
              type:
                entry.type === 'task' ||
                entry.type === 'focus' ||
                entry.type === 'notes_review'
                  ? entry.type
                  : 'workflow',
              title,
              enabled: asBoolean(entry.enabled, true),
              remindAt,
              frequency:
                entry.frequency === 'daily' ||
                entry.frequency === 'weekly' ||
                entry.frequency === 'monthly'
                  ? entry.frequency
                  : 'none',
              nextReminderAt:
                typeof entry.nextReminderAt === 'string' || entry.nextReminderAt === null
                  ? entry.nextReminderAt
                  : null,
              lastTriggeredAt:
                typeof entry.lastTriggeredAt === 'string' || entry.lastTriggeredAt === null
                  ? entry.lastTriggeredAt
                  : null,
              localOnly: true,
            }
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      },
      release: {
        buildChannel: release.buildChannel === 'production' ? 'production' : 'development',
        releaseType:
          release.releaseType === 'beta_prep' || release.releaseType === 'stable_prep'
            ? release.releaseType
            : 'dev_snapshot',
        environmentStatus:
          release.environmentStatus === 'desktop_shell' ||
          release.environmentStatus === 'packaged_desktop'
            ? release.environmentStatus
            : 'browser_fallback',
        packagingPrep: isObject(release.packagingPrep)
          ? {
              installerReadyPlaceholder: asBoolean(
                release.packagingPrep.installerReadyPlaceholder,
              ),
              portableModeReadyPlaceholder: asBoolean(
                release.packagingPrep.portableModeReadyPlaceholder,
              ),
              optionalUpdaterPlanned: asBoolean(release.packagingPrep.optionalUpdaterPlanned, true),
            }
          : {
              installerReadyPlaceholder: false,
              portableModeReadyPlaceholder: false,
            optionalUpdaterPlanned: true,
            },
      },
      security: {
        encryptionPrep: isObject(security.encryptionPrep)
          ? {
              encryptedLocalExportPlanned: asBoolean(
                security.encryptionPrep.encryptedLocalExportPlanned,
                true,
              ),
              encryptedSyncPayloadPlanned: asBoolean(
                security.encryptionPrep.encryptedSyncPayloadPlanned,
                true,
              ),
              encryptedMemoryCategoriesPlanned: asBoolean(
                security.encryptionPrep.encryptedMemoryCategoriesPlanned,
                true,
              ),
              securePairingPlanned: asBoolean(security.encryptionPrep.securePairingPlanned, true),
            }
          : {
              encryptedLocalExportPlanned: true,
              encryptedSyncPayloadPlanned: true,
              encryptedMemoryCategoriesPlanned: true,
              securePairingPlanned: true,
            },
        partitioning: isObject(security.partitioning)
          ? {
              healthSensitiveCategories: asArray(security.partitioning.healthSensitiveCategories)
                .map((item) => asString(item, 'note'))
                .filter(Boolean),
              familySeniorSensitiveCategories: asArray(
                security.partitioning.familySeniorSensitiveCategories,
              )
                .map((item) => asString(item, 'note'))
                .filter(Boolean),
              localAiSafeOnlyVisibility: asBoolean(
                security.partitioning.localAiSafeOnlyVisibility,
              ),
              exportSafeOnlyVisibility: asBoolean(
                security.partitioning.exportSafeOnlyVisibility,
              ),
              syncEligibleOnlyVisibility: asBoolean(
                security.partitioning.syncEligibleOnlyVisibility,
              ),
            }
          : {
              healthSensitiveCategories: ['health_context', 'blood_sugar', 'medicine', 'symptom'],
              familySeniorSensitiveCategories: ['safe_note', 'user_preference'],
              localAiSafeOnlyVisibility: false,
              exportSafeOnlyVisibility: false,
              syncEligibleOnlyVisibility: false,
            },
        localOnlyIndicatorsEnabled: asBoolean(security.localOnlyIndicatorsEnabled, true),
      },
      tester: {
        feedback: isObject(tester.feedback)
          ? {
              testerNotes: asString(tester.feedback.testerNotes),
              bugReportDraft: asString(tester.feedback.bugReportDraft),
              localFeedbackQueue: asArray(tester.feedback.localFeedbackQueue)
                .map((item) => asString(item).trim())
                .filter(Boolean)
                .slice(0, 50),
            }
          : {
              testerNotes: '',
              bugReportDraft: '',
              localFeedbackQueue: [],
            },
        debugTools: isObject(tester.debugTools)
          ? {
              compactResetPrepEnabled: asBoolean(tester.debugTools.compactResetPrepEnabled, true),
              safeCacheClearPrepEnabled: asBoolean(
                tester.debugTools.safeCacheClearPrepEnabled,
                true,
              ),
              workflowResetPrepEnabled: asBoolean(tester.debugTools.workflowResetPrepEnabled, true),
              importExportValidationPrepEnabled: asBoolean(
                tester.debugTools.importExportValidationPrepEnabled,
                true,
              ),
            }
          : {
              compactResetPrepEnabled: true,
              safeCacheClearPrepEnabled: true,
              workflowResetPrepEnabled: true,
              importExportValidationPrepEnabled: true,
            },
      },
      accessibility: {
        largerText: asBoolean(accessibility.largerText, false),
        higherContrast: asBoolean(accessibility.higherContrast, false),
        keyboardNavigationPrep: asBoolean(accessibility.keyboardNavigationPrep, true),
        simplifiedWording: asBoolean(accessibility.simplifiedWording, false),
      },
      androidEcosystem: {
        sharedWorkflowSyncPrep: asBoolean(androidEcosystem.sharedWorkflowSyncPrep, true),
        sharedNotesTasksSummaryPrep: asBoolean(
          androidEcosystem.sharedNotesTasksSummaryPrep,
          true,
        ),
        sharedFocusSessionsPrep: asBoolean(androidEcosystem.sharedFocusSessionsPrep, true),
        sharedFamilySeniorSummaryPrep: asBoolean(
          androidEcosystem.sharedFamilySeniorSummaryPrep,
          true,
        ),
        aiSafeMemorySyncPreviewPrep: asBoolean(
          androidEcosystem.aiSafeMemorySyncPreviewPrep,
          true,
        ),
      },
      localAi: {
        providerMode: localAi.providerMode === 'ollama' ? 'ollama' : 'rule_based',
        ollama: {
          enabled: (() => {
            const canonicalEnabled = isObject(localAi.ollama) ? localAi.ollama.enabled : undefined
            if (typeof canonicalEnabled === 'boolean') {
              return canonicalEnabled
            }
            return asBoolean(
              localAi.ollamaEnabled,
              asBoolean(localAi.enableOllama, localAi.providerMode === 'ollama'),
            )
          })(),
          baseUrl: asString(
            isObject(localAi.ollama) ? localAi.ollama.baseUrl : undefined,
            'http://localhost:11434',
          ),
          selectedModel: asString(
            isObject(localAi.ollama) ? localAi.ollama.selectedModel : undefined,
          ),
          availableModels: asArray(
            isObject(localAi.ollama) ? localAi.ollama.availableModels : undefined,
          )
            .map((item) => asString(item).trim())
            .filter(Boolean),
          lastStatus:
            isObject(localAi.ollama) &&
            (localAi.ollama.lastStatus === 'checking' ||
              localAi.ollama.lastStatus === 'ready' ||
              localAi.ollama.lastStatus === 'error')
              ? localAi.ollama.lastStatus
              : 'unavailable',
          lastCheckedAt:
            isObject(localAi.ollama) &&
            (typeof localAi.ollama.lastCheckedAt === 'string' ||
              localAi.ollama.lastCheckedAt === null)
              ? localAi.ollama.lastCheckedAt
              : null,
          errorMessage: asString(
            isObject(localAi.ollama) ? localAi.ollama.errorMessage : undefined,
          ),
        },
        context: {
          contextMode:
            isObject(localAi.context) &&
            (localAi.context.contextMode === 'recent_chat_only' ||
              localAi.context.contextMode === 'extended_chat')
              ? localAi.context.contextMode
              : 'minimal',
          maxContextMessages: (() => {
            const parsed = Number(isObject(localAi.context) ? localAi.context.maxContextMessages : 6)
            return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), 1), 40) : 6
          })(),
          allowConversationTitles: asBoolean(
            isObject(localAi.context) ? localAi.context.allowConversationTitles : undefined,
            false,
          ),
          allowTaskContext: asBoolean(
            isObject(localAi.context) ? localAi.context.allowTaskContext : undefined,
            false,
          ),
          allowNotesContext: asBoolean(
            isObject(localAi.context) ? localAi.context.allowNotesContext : undefined,
            false,
          ),
          allowMemoryHighlights: asBoolean(
            isObject(localAi.context) ? localAi.context.allowMemoryHighlights : undefined,
            false,
          ),
        },
      },
    },
    workflows: {
      notes: {
        input: asString(notes.input),
        cleanText: asString(notes.cleanText),
        shoppingItems: asArray(notes.shoppingItems)
          .map((entry, index) => normalizeChecklistItem(entry, index))
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        taskItems: asArray(notes.taskItems)
          .map((entry, index) => normalizeTaskItem(entry, index) ?? normalizeChecklistItem(entry, index))
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .map((entry) =>
            'dueDate' in entry
              ? entry
              : {
                  id: entry.id,
                  label: entry.label,
                  completed: entry.completed,
                  dueDate: null,
                  priority: 'normal',
                  category: 'general',
                  pinned: false,
                  syncMeta: createDefaultSyncMeta(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
          ),
        taskSearch: asString(notes.taskSearch),
        taskFilterStatus: asString(notes.taskFilterStatus, 'all'),
        taskFilterCategory: asString(notes.taskFilterCategory, 'all'),
        template: asString(notes.template, 'blank'),
        updatedAt:
          typeof notes.updatedAt === 'string' || notes.updatedAt === null
            ? notes.updatedAt
            : null,
      },
      chat: {
        conversations: safeConversations,
        activeConversationId: safeActiveConversationId,
      },
      dashboard: {
        collapsedSections: asArray(dashboard.collapsedSections)
          .map((entry) => asString(entry))
          .filter(Boolean),
        pinnedWidgets: asArray(dashboard.pinnedWidgets)
          .map((entry) => asString(entry))
          .filter(Boolean),
        quickActionIds: asArray(dashboard.quickActionIds)
          .map((entry) => asString(entry))
          .filter(Boolean),
      },
      syncSessions: asArray(workflows.syncSessions)
        .map((entry) => {
          if (!isObject(entry)) {
            return null
          }
          const syncSessionId = asString(entry.syncSessionId).trim()
          const pairedDeviceId = asString(entry.pairedDeviceId).trim()
          if (!syncSessionId || !pairedDeviceId) {
            return null
          }
          return {
            syncSessionId,
            pairedDeviceId,
            syncState:
              entry.syncState === 'pairing' ||
              entry.syncState === 'ready' ||
              entry.syncState === 'syncing' ||
              entry.syncState === 'error'
                ? entry.syncState
                : 'inactive',
            lastSyncAt:
              typeof entry.lastSyncAt === 'string' || entry.lastSyncAt === null
                ? entry.lastSyncAt
                : null,
            pendingChanges: Math.max(0, Math.round(Number(entry.pendingChanges) || 0)),
            syncDirection:
              entry.syncDirection === 'pc_to_android' ||
              entry.syncDirection === 'android_to_pc'
                ? entry.syncDirection
                : 'bidirectional',
            syncConflictState:
              entry.syncConflictState === 'detected' || entry.syncConflictState === 'manual_review'
                ? entry.syncConflictState
                : 'none',
            transport:
              entry.transport === 'lan' || entry.transport === 'tailscale'
                ? entry.transport
                : 'localhost_bridge',
            transportAvailable: asBoolean(entry.transportAvailable),
            localOnly: true,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      syncConflicts: asArray(workflows.syncConflicts)
        .map((entry, index) => {
          if (!isObject(entry)) {
            return null
          }
          const entityId = asString(entry.entityId).trim()
          if (!entityId) {
            return null
          }
          return {
            id: asString(entry.id, `sync-conflict-${index}`),
            entityType:
              entry.entityType === 'task' ||
              entry.entityType === 'note' ||
              entry.entityType === 'workflow' ||
              entry.entityType === 'settings'
                ? entry.entityType
                : 'memory',
            entityId,
            localVersion: Math.max(1, Math.round(Number(entry.localVersion) || 1)),
            remoteVersion: Math.max(1, Math.round(Number(entry.remoteVersion) || 1)),
            lastWriteAtLocal: asString(entry.lastWriteAtLocal, new Date().toISOString()),
            lastWriteAtRemote: asString(entry.lastWriteAtRemote, new Date().toISOString()),
            summary: asString(entry.summary, 'Local conflict requires manual review.'),
            requiresManualResolution: true,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      routines: asArray(workflows.routines)
        .map((entry, index) => {
          if (!isObject(entry)) {
            return null
          }
          const steps = asArray(entry.steps)
            .map((step, stepIndex) => {
              if (!isObject(step)) {
                return null
              }
              const title = asString(step.title).trim()
              if (!title) {
                return null
              }
              const rawDelay = Number(step.delaySeconds)
              return {
                id: asString(step.id, `workflow-step-${index}-${stepIndex}`),
                title,
                detail: asString(step.detail),
                type:
                  step.type === 'checklist' ||
                  step.type === 'timer' ||
                  step.type === 'review'
                    ? step.type
                    : 'prompt',
                delaySeconds:
                  Number.isFinite(rawDelay) && rawDelay > 0
                    ? Math.min(Math.round(rawDelay), 3600)
                    : undefined,
              }
            })
            .filter((step): step is NonNullable<typeof step> => step !== null)
          return {
            id: asString(entry.id, `workflow-${index}`),
            name: asString(entry.name, `Workflow ${index + 1}`),
            description: asString(entry.description),
            category: asString(entry.category, 'custom'),
            trigger: 'manual',
            enabled: asBoolean(entry.enabled, true),
            status:
              entry.status === 'running' ||
              entry.status === 'completed' ||
              entry.status === 'failed'
                ? entry.status
                : 'idle',
            lastRunAt:
              typeof entry.lastRunAt === 'string' || entry.lastRunAt === null
                ? entry.lastRunAt
                : null,
            syncMeta: isObject(entry.syncMeta)
              ? {
                  lastModified: asString(entry.syncMeta.lastModified, new Date().toISOString()),
                  syncEligible: asBoolean(entry.syncMeta.syncEligible, true),
                  syncVersion: Number(entry.syncMeta.syncVersion) || 1,
                  deviceSource:
                    entry.syncMeta.deviceSource === 'android_future' ||
                    entry.syncMeta.deviceSource === 'unknown'
                      ? entry.syncMeta.deviceSource
                      : 'desktop_local',
                  pendingSync: asBoolean(entry.syncMeta.pendingSync),
                  localOnly: asBoolean(entry.syncMeta.localOnly, true),
                }
              : createDefaultSyncMeta(),
            steps,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      routineRuntime: isObject(workflows.routineRuntime)
        ? {
            activeRoutineId: asString(workflows.routineRuntime.activeRoutineId) || null,
            status:
              workflows.routineRuntime.status === 'running' ||
              workflows.routineRuntime.status === 'completed' ||
              workflows.routineRuntime.status === 'failed'
                ? workflows.routineRuntime.status
                : 'idle',
            message: asString(workflows.routineRuntime.message, 'No workflow run yet.'),
            updatedAt:
              typeof workflows.routineRuntime.updatedAt === 'string' ||
              workflows.routineRuntime.updatedAt === null
                ? workflows.routineRuntime.updatedAt
                : null,
          }
        : {
            activeRoutineId: null,
            status: 'idle',
            message: 'No workflow run yet.',
            updatedAt: null,
          },
      reminders: asArray(workflows.reminders)
        .map((entry, index) => {
          if (!isObject(entry)) {
            return null
          }
          const title = asString(entry.title).trim()
          const remindAt = asString(entry.remindAt).trim()
          if (!title || !remindAt) {
            return null
          }
          return {
            id: asString(entry.id, `reminder-${index}`),
            type:
              entry.type === 'task' || entry.type === 'focus' || entry.type === 'notes_review'
                ? entry.type
                : 'workflow',
            title,
            enabled: asBoolean(entry.enabled, true),
            remindAt,
            frequency:
              entry.frequency === 'daily' ||
              entry.frequency === 'weekly' ||
              entry.frequency === 'monthly'
                ? entry.frequency
                : 'none',
            nextReminderAt:
              typeof entry.nextReminderAt === 'string' || entry.nextReminderAt === null
                ? entry.nextReminderAt
                : null,
            lastTriggeredAt:
              typeof entry.lastTriggeredAt === 'string' || entry.lastTriggeredAt === null
                ? entry.lastTriggeredAt
                : null,
            localOnly: true,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      activityLog: asArray(workflows.activityLog)
        .map((entry, index) => normalizeActivityEntry(entry, index))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .slice(0, 100),
    },
  }
}

const isIpv4Address = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(value)

const pickLocalNetworkIp = (): string | null => {
  const interfaces = networkInterfaces()
  for (const records of Object.values(interfaces) as unknown[]) {
    if (!Array.isArray(records)) {
      continue
    }

    for (const record of records) {
      if (!isObject(record)) {
        continue
      }

      const family = asString(record.family)
      const internal = asBoolean(record.internal)
      const address = asString(record.address)
      if (
        family === 'IPv4' &&
        !internal &&
        isIpv4Address(address) &&
        !address.startsWith('100.')
      ) {
        return address
      }
    }
  }

  return null
}

const pickTailscaleIpFromInterfaces = (): string | null => {
  const interfaces = networkInterfaces()

  for (const [name, records] of Object.entries(interfaces) as Array<[string, unknown]>) {
    if (!Array.isArray(records)) {
      continue
    }

    const looksLikeTailscale = name.toLowerCase().includes('tailscale')
    for (const record of records) {
      if (!isObject(record)) {
        continue
      }

      const address = asString(record.address)
      const family = asString(record.family)
      if (!isIpv4Address(address) || family !== 'IPv4') {
        continue
      }

      if (looksLikeTailscale || address.startsWith('100.')) {
        return address
      }
    }
  }

  return null
}

const readTailscaleStatusFromCli = async () => {
  try {
    const result = await execFile('tailscale', ['status', '--json'], {
      timeout: 1500,
      windowsHide: true,
    })
    const parsed = JSON.parse(result.stdout) as unknown

    if (!isObject(parsed)) {
      return null
    }

    const backendState = asString(parsed.BackendState).toLowerCase()
    const self = isObject(parsed.Self) ? parsed.Self : null
    const tailscaleIps = self ? asArray(self.TailscaleIPs) : []
    const firstIp = tailscaleIps.find((item) => isIpv4Address(item)) ?? null

    return {
      detected: true,
      running: backendState === 'running',
      ip: firstIp,
      backendState,
    }
  } catch {
    return null
  }
}

const detectTailscaleProcessRunning = async () => {
  if (process.platform !== 'win32') {
    return false
  }

  try {
    const result = await execFile('tasklist', ['/FI', 'IMAGENAME eq tailscaled.exe'], {
      timeout: 1200,
      windowsHide: true,
    })
    return result.stdout.toLowerCase().includes('tailscaled.exe')
  } catch {
    return false
  }
}

const getNetworkStatus = async (): Promise<StoredNetworkStatus> => {
  const checkedAt = new Date().toISOString()
  const notes: string[] = []
  const localNetworkIp = pickLocalNetworkIp()
  const interfaceTailscaleIp = pickTailscaleIpFromInterfaces()
  const cliStatus = await readTailscaleStatusFromCli()
  const processRunning = await detectTailscaleProcessRunning()

  const tailscaleDetected = Boolean(cliStatus || interfaceTailscaleIp || processRunning)
  const tailscaleRunning = cliStatus ? cliStatus.running : Boolean(interfaceTailscaleIp || processRunning)
  const tailscaleIp = cliStatus?.ip ?? interfaceTailscaleIp

  if (!localNetworkIp) {
    notes.push('No local LAN IPv4 address detected yet.')
  }
  if (!tailscaleDetected) {
    notes.push('Tailscale was not detected on this machine.')
  } else if (!tailscaleRunning) {
    notes.push('Tailscale appears installed but not connected.')
  } else if (tailscaleIp) {
    notes.push(`Tailscale connected at ${tailscaleIp}.`)
  }

  const readinessStatus: StoredNetworkStatus['readinessStatus'] =
    tailscaleRunning && Boolean(tailscaleIp)
      ? 'hybrid_ready'
      : tailscaleDetected
        ? 'remote_ready_partial'
        : 'local_only'

  return {
    localhostStatus: 'online',
    localNetworkIp,
    tailscaleDetected,
    tailscaleRunning,
    tailscaleIp,
    readinessStatus,
    checkedAt,
    notes,
  }
}

type AndroidBridgeRuntimeState = {
  active: boolean
  mode: 'off' | 'local_only' | 'tailscale_ready'
  port: number
  note: string
}

const createAndroidBridgePlaceholder = () => {
  // Future Android ecosystem contract prep:
  // - GodzillaMode launcher handshake over localhost/Tailscale-only links
  // - offline-first sync summaries (workflows, notes/tasks, focus, family/senior, AI-safe memory)
  // - explicit local eligibility checks before any bridge payload is exchanged
  const state: AndroidBridgeRuntimeState = {
    active: false,
    mode: 'off',
    port: 43117,
    note: 'Bridge placeholder only. No socket is listening in this phase.',
  }

  return {
    getState: () => ({ ...state }),
    configureFromSettings: (settings: unknown) => {
      if (!isObject(settings)) {
        return
      }
      const parsedPort = Number(settings.localBridgePort)
      state.port =
        Number.isFinite(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535
          ? Math.round(parsedPort)
          : 43117
      state.mode =
        settings.bridgeMode === 'local_only' || settings.bridgeMode === 'tailscale_ready'
          ? settings.bridgeMode
          : 'off'
      state.active = false
    },
    start: async () => {
      // TODO(Phase 6+): start loopback/Tailscale-only listener when explicitly enabled.
      state.active = false
      return state.active
    },
    stop: async () => {
      state.active = false
      return true
    },
  }
}

const androidBridgePlaceholder = createAndroidBridgePlaceholder()

const privateBrowserAccessState: {
  server: http.Server | null
  status: PrivateBrowserAccessStatus['status']
  mode: PrivateBrowserAccessMode
  host: string
  port: number
  localhostUrl: string | null
  lanUrl: string | null
  tailscaleUrl: string | null
  message: string
} = {
  server: null,
  status: 'stopped',
  mode: 'localhost_only',
  host: '127.0.0.1',
  port: 4173,
  localhostUrl: null,
  lanUrl: null,
  tailscaleUrl: null,
  message: 'Private browser access is stopped.',
}

const mimeByExtension: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const resolvePrivateBrowserHost = (mode: unknown): string =>
  mode === 'lan' || mode === 'tailscale' ? '0.0.0.0' : '127.0.0.1'

const privateBrowserAccessStatus = (): PrivateBrowserAccessStatus => ({
  status: privateBrowserAccessState.status,
  available: true,
  host: privateBrowserAccessState.host,
  port: privateBrowserAccessState.port,
  localhostUrl: privateBrowserAccessState.localhostUrl,
  lanUrl: privateBrowserAccessState.lanUrl,
  tailscaleUrl: privateBrowserAccessState.tailscaleUrl,
  message: privateBrowserAccessState.message,
})

const writeJsonResponse = (response: http.ServerResponse, statusCode: number, value: unknown) => {
  const payload = JSON.stringify(value)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

const readRequestJson = async (request: http.IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalLength = 0
    request.on('data', (chunk) => {
      const buffer = Buffer.from(chunk)
      totalLength += buffer.byteLength
      if (totalLength > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'))
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim()
        resolve(raw ? (JSON.parse(raw) as unknown) : {})
      } catch {
        reject(new Error('Malformed JSON payload'))
      }
    })
    request.on('error', () => {
      reject(new Error('Failed to read request body'))
    })
  })

const safePrivateBrowserPort = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535
    ? Math.round(parsed)
    : 4173
}

const buildPrivateBrowserUrls = async (port: number) => {
  const lanIp = pickLocalNetworkIp()
  const tailscaleIp = (await readTailscaleStatusFromCli())?.ip ?? pickTailscaleIpFromInterfaces()
  return {
    localhostUrl: `http://127.0.0.1:${port}`,
    lanUrl: lanIp ? `http://${lanIp}:${port}` : null,
    tailscaleUrl: tailscaleIp ? `http://${tailscaleIp}:${port}` : null,
  }
}

const privateBrowserDistRoot = () => path.resolve(__dirname, '../dist')

const createPrivateBrowserServer = (distRoot: string) =>
  http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost')
      const method = (request.method ?? 'GET').toUpperCase()
      if (requestUrl.pathname === '/api/bridge/status' && method === 'GET') {
        const payload: PrivateBridgeStatusResponse = {
          ok: true,
          hostMode: privateBrowserAccessState.mode,
          appName: app.getName(),
          version: app.getVersion(),
          bridgeAvailable: true,
          localOnly: true,
          checkedAt: new Date().toISOString(),
        }
        writeJsonResponse(response, 200, payload)
        return
      }
      if (requestUrl.pathname === '/api/app-data' && method === 'GET') {
        const data = await readAppData()
        writeJsonResponse(response, 200, {
          ok: true,
          localOnly: true,
          data,
        })
        return
      }
      if (requestUrl.pathname === '/api/app-data' && method === 'POST') {
        try {
          const parsed = await readRequestJson(request)
          const payload =
            isObject(parsed) && 'data' in parsed ? (parsed as Record<string, unknown>).data : parsed
          const saved = await writeAppData(payload)
          writeJsonResponse(response, 200, {
            ok: true,
            localOnly: true,
            data: saved,
          })
        } catch (error) {
          const message =
            error instanceof Error && error.message === 'Payload too large'
              ? 'Payload too large.'
              : 'Invalid app data payload.'
          writeJsonResponse(response, 400, {
            ok: false,
            localOnly: true,
            error: message,
          })
        }
        return
      }
      const pathname = decodeURIComponent(requestUrl.pathname)
      const normalizedRequestPath = path.normalize(pathname).replace(/^([\\/])+/, '')
      const candidatePath = path.resolve(distRoot, normalizedRequestPath)
      const safeRoot = path.resolve(distRoot)
      const withinRoot =
        candidatePath === safeRoot || candidatePath.startsWith(`${safeRoot}${path.sep}`)

      if (!withinRoot) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Forbidden')
        return
      }

      let filePath = candidatePath
      let fileStat = null as Awaited<ReturnType<typeof stat>> | null
      try {
        fileStat = await stat(filePath)
        if (fileStat.isDirectory()) {
          filePath = path.join(filePath, 'index.html')
          fileStat = await stat(filePath)
        }
      } catch {
        fileStat = null
      }

      const extension = path.extname(filePath).toLowerCase()
      const isAssetRequest = extension.length > 0
      if (!fileStat || !fileStat.isFile()) {
        if (isAssetRequest) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          response.end('Not found')
          return
        }
        filePath = path.join(safeRoot, 'index.html')
      }

      const body = await readFile(filePath)
      response.writeHead(200, {
        'Content-Type': mimeByExtension[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      response.end(body)
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Private browser access failed to serve the request.')
    }
  })

const startPrivateBrowserAccess = async (config: unknown): Promise<PrivateBrowserAccessStatus> => {
  const mode: PrivateBrowserAccessMode =
    isObject(config) && (config.browserHostMode === 'lan' || config.browserHostMode === 'tailscale')
      ? config.browserHostMode
      : 'localhost_only'
  const port = isObject(config) ? safePrivateBrowserPort(config.browserPort) : 4173
  const host = resolvePrivateBrowserHost(mode)
  const distRoot = privateBrowserDistRoot()

  try {
    const info = await stat(path.join(distRoot, 'index.html'))
    if (!info.isFile()) {
      throw new Error('Build output is missing.')
    }
  } catch {
    privateBrowserAccessState.status = 'failed'
    privateBrowserAccessState.message = 'Build output missing. Run npm run build first.'
    return privateBrowserAccessStatus()
  }

  if (privateBrowserAccessState.server) {
    await stopPrivateBrowserAccess()
  }

  privateBrowserAccessState.status = 'starting'
  privateBrowserAccessState.mode = mode
  privateBrowserAccessState.host = host
  privateBrowserAccessState.port = port
  privateBrowserAccessState.message = 'Starting private browser access...'

  const server = createPrivateBrowserServer(distRoot)
  let startFailed = false
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (!settled) {
        settled = true
        resolve()
      }
    }
    server.once('error', (error: NodeJS.ErrnoException) => {
      startFailed = true
      privateBrowserAccessState.server = null
      privateBrowserAccessState.status = 'failed'
      privateBrowserAccessState.localhostUrl = null
      privateBrowserAccessState.lanUrl = null
      privateBrowserAccessState.tailscaleUrl = null
      privateBrowserAccessState.message =
        error.code === 'EADDRINUSE'
          ? `Port ${port} is already in use. Choose another port and try again.`
          : 'Unable to start private browser access on this PC.'
      finish()
    })
    server.listen(port, host, () => {
      privateBrowserAccessState.server = server
      finish()
    })
  })

  if (startFailed) {
    try {
      server.close()
    } catch {
      // no-op
    }
    return privateBrowserAccessStatus()
  }

  const urls = await buildPrivateBrowserUrls(port)
  privateBrowserAccessState.status = 'running'
  privateBrowserAccessState.localhostUrl = urls.localhostUrl
  privateBrowserAccessState.lanUrl = urls.lanUrl
  privateBrowserAccessState.tailscaleUrl = urls.tailscaleUrl
  privateBrowserAccessState.message = 'Private browser access is running.'
  return privateBrowserAccessStatus()
}

const stopPrivateBrowserAccess = async (): Promise<PrivateBrowserAccessStatus> => {
  const server = privateBrowserAccessState.server
  if (!server) {
    privateBrowserAccessState.status = 'stopped'
    privateBrowserAccessState.localhostUrl = null
    privateBrowserAccessState.lanUrl = null
    privateBrowserAccessState.tailscaleUrl = null
    privateBrowserAccessState.message = 'Private browser access is stopped.'
    return privateBrowserAccessStatus()
  }

  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  privateBrowserAccessState.server = null
  privateBrowserAccessState.status = 'stopped'
  privateBrowserAccessState.localhostUrl = null
  privateBrowserAccessState.lanUrl = null
  privateBrowserAccessState.tailscaleUrl = null
  privateBrowserAccessState.message = 'Private browser access is stopped.'
  return privateBrowserAccessStatus()
}

const ensureDataFile = async () => {
  const filePath = dataFilePath()
  await mkdir(path.dirname(filePath), { recursive: true })

  try {
    await readFile(filePath, 'utf8')
  } catch {
    await writeFile(filePath, JSON.stringify(defaultAppData(), null, 2), 'utf8')
  }
}

const backupCorruptData = async (raw: string) => {
  const filePath = path.join(
    app.getPath('userData'),
    `godzillamodeai.corrupt-${Date.now()}.json`,
  )

  try {
    await writeFile(filePath, raw, 'utf8')
  } catch {
    // Best-effort backup only.
  }
}

const readAppData = async () => {
  await ensureDataFile()
  const raw = await readFile(dataFilePath(), 'utf8')

  try {
    const normalized = normalizeData(JSON.parse(raw))
    const settings = isObject(normalized.settings) ? normalized.settings : null
    const androidBridgeSettings =
      settings && isObject(settings.androidBridge) ? settings.androidBridge : null
    androidBridgePlaceholder.configureFromSettings(androidBridgeSettings)
    return normalized
  } catch {
    await backupCorruptData(raw)
    const fallback = defaultAppData()
    await writeFile(dataFilePath(), JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

const safeOllamaBaseUrl = (value: unknown) => {
  const fallback = 'http://localhost:11434'
  const raw = asString(value, fallback).trim() || fallback

  try {
    const parsed = new URL(raw)
    const protocol = parsed.protocol.toLowerCase()
    const host = parsed.hostname.toLowerCase()
    const isLoopbackHost =
      host === 'localhost' || host === '127.0.0.1' || host === '::1'

    if (!isLoopbackHost || (protocol !== 'http:' && protocol !== 'https:')) {
      return fallback
    }

    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

const readJson = async (
  url: URL,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json?: unknown; error?: string }> =>
  new Promise((resolve) => {
    const lib = url.protocol === 'https:' ? https : http
    const request = lib.request(
      url,
      { method: 'GET', timeout: timeoutMs },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          const status = response.statusCode ?? 0
          const body = Buffer.concat(chunks).toString('utf8')
          if (status < 200 || status >= 300) {
            resolve({ ok: false, status, error: `HTTP ${status}` })
            return
          }

          try {
            resolve({ ok: true, status, json: JSON.parse(body) as unknown })
          } catch {
            resolve({ ok: false, status, error: 'Malformed JSON response.' })
          }
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('Request timed out.'))
    })
    request.on('error', (error) => {
      resolve({
        ok: false,
        status: 0,
        error: error?.message?.trim() || 'Connection failed.',
      })
    })
    request.end()
  })

const postJson = async (
  url: URL,
  payload: unknown,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json?: unknown; error?: string }> =>
  new Promise((resolve) => {
    const body = JSON.stringify(payload)
    const lib = url.protocol === 'https:' ? https : http
    console.info(
      '[GodzillaModeAI] Ollama request',
      JSON.stringify({
        url: url.toString(),
        payload,
      }),
    )
    const request = lib.request(
      url,
      {
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          const status = response.statusCode ?? 0
          const responseText = Buffer.concat(chunks).toString('utf8')
          console.info(
            '[GodzillaModeAI] Ollama response',
            JSON.stringify({
              url: url.toString(),
              status,
              body: responseText,
            }),
          )
          if (status < 200 || status >= 300) {
            let details = `HTTP ${status}`
            try {
              const parsedError = JSON.parse(responseText) as unknown
              if (isObject(parsedError)) {
                const message = asString(parsedError.error).trim()
                if (message) {
                  details = message
                }
              }
            } catch {
              const trimmed = responseText.trim()
              if (trimmed) {
                details = trimmed.slice(0, 180)
              }
            }
            resolve({ ok: false, status, error: details })
            return
          }

          try {
            resolve({ ok: true, status, json: JSON.parse(responseText) as unknown })
          } catch {
            resolve({ ok: false, status, error: 'Malformed JSON response.' })
          }
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('Request timed out.'))
    })
    request.on('error', (error) => {
      console.warn(
        '[GodzillaModeAI] Ollama request error',
        JSON.stringify({
          url: url.toString(),
          error: error?.message ?? 'Connection failed.',
        }),
      )
      resolve({ ok: false, status: 0, error: error?.message || 'Connection failed.' })
    })
    request.write(body)
    request.end()
  })

const getOllamaStatus = async (url: unknown, selectedModel: unknown) => {
  const checkedAt = new Date().toISOString()
  const safeUrl = safeOllamaBaseUrl(url)
  const selected = asString(selectedModel).trim()
  const tagsUrl = new URL('/api/tags', safeUrl)
  const result = await readJson(tagsUrl, 2500)

  if (!result.ok || !isObject(result.json)) {
    return {
      available: false,
      url: safeUrl,
      models: [],
      selectedModelAvailable: false,
      selectedModel: selected,
      message: result.error ?? 'Ollama unavailable.',
      checkedAt,
      desktopBridgeRequired: false,
    }
  }

  const rawModels = asArray(result.json.models)
  const models = rawModels
    .map((entry) => (isObject(entry) ? asString(entry.name).trim() : ''))
    .filter(Boolean)
    .map((name) => ({ name }))
  const selectedModelAvailable = selected.length > 0 && models.some((item) => item.name === selected)
  const message =
    models.length > 0
      ? 'Connected to local Ollama.'
      : 'Connected to Ollama, but no local models are installed.'

  return {
    available: true,
    url: safeUrl,
    models,
    selectedModelAvailable,
    selectedModel: selected,
    message,
    checkedAt,
    desktopBridgeRequired: false,
  }
}

const checkOllamaStatus = async (baseUrl: unknown) => {
  const status = await getOllamaStatus(baseUrl, '')
  return {
    status: status.available ? 'ready' : 'unavailable',
    baseUrl: status.url,
    reachable: status.available,
    message: status.message,
    checkedAt: status.checkedAt,
    errorMessage: status.available ? '' : status.message,
  }
}

const listOllamaModels = async (baseUrl: unknown) => {
  const status = await getOllamaStatus(baseUrl, '')
  return {
    status: status.available ? 'ready' : 'unavailable',
    baseUrl: status.url,
    models: status.models.map((model) => model.name),
    message: status.message,
    checkedAt: status.checkedAt,
    errorMessage: status.available ? '' : status.message,
  }
}

const generateWithOllama = async (baseUrl: unknown, model: unknown, prompt: unknown) => {
  const safeUrl = safeOllamaBaseUrl(baseUrl)
  const safeModel = asString(model).trim()
  const safePrompt = asString(prompt).trim()

  if (!safeModel) {
    return {
      ok: false,
      text: '',
      model: safeModel,
      baseUrl: safeUrl,
      message: 'No Ollama model selected.',
      errorMessage: 'No Ollama model selected.',
    }
  }
  if (!safePrompt) {
    return {
      ok: false,
      text: '',
      model: safeModel,
      baseUrl: safeUrl,
      message: 'Prompt is empty.',
      errorMessage: 'Prompt is empty.',
    }
  }

  const endpoint = new URL('/api/generate', safeUrl)
  const result = await postJson(
    endpoint,
    { model: safeModel, prompt: safePrompt, stream: false },
    60000,
  )
  if (!result.ok || !isObject(result.json)) {
    const errorText = (result.error || '').toLowerCase()
    const friendlyError = errorText.includes('timed out')
      ? 'The local model took too long to respond.'
      : result.error?.trim() || 'Ollama is not reachable on this PC.'
    console.warn(
      '[GodzillaModeAI] Ollama generation failed.',
      JSON.stringify({
        endpoint: endpoint.toString(),
        model: safeModel,
        status: result.status,
        error: result.error ?? 'unknown',
      }),
    )
    return {
      ok: false,
      text: '',
      model: safeModel,
      baseUrl: safeUrl,
      message: friendlyError,
      errorMessage: friendlyError,
    }
  }

  const text = asString(result.json.response).trim()
  if (!text) {
    console.warn(
      '[GodzillaModeAI] Ollama returned empty response.',
      JSON.stringify({
        endpoint: endpoint.toString(),
        model: safeModel,
      }),
    )
    return {
      ok: false,
      text: '',
      model: safeModel,
      baseUrl: safeUrl,
      message: 'Ollama returned an empty response.',
      errorMessage: 'Ollama returned an empty response.',
    }
  }

  return {
    ok: true,
    text,
    model: safeModel,
    baseUrl: safeUrl,
    message: 'Ollama response ready.',
    errorMessage: '',
  }
}

const writeAppData = async (value: unknown) => {
  const normalized = normalizeData(value)
  const settings = isObject(normalized.settings) ? normalized.settings : null
  const androidBridgeSettings =
    settings && isObject(settings.androidBridge) ? settings.androidBridge : null
  androidBridgePlaceholder.configureFromSettings(androidBridgeSettings)
  await ensureDataFile()
  await writeFile(dataFilePath(), JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}

const createWindow = async () => {
  const preloadCjsPath = path.join(__dirname, 'preload.cjs')
  const preloadPath = existsSync(preloadCjsPath)
    ? preloadCjsPath
    : path.join(__dirname, 'preload.js')
  const window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: 'KCxModeAI',
    backgroundColor: '#020817',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    await window.loadURL(devServerUrl)
    window.webContents.openDevTools({ mode: 'detach' })
    return
  }

  await window.loadFile(path.resolve(__dirname, '../dist/index.html'))
}

const registerIpc = () => {
  // Phase 20 prep notes:
  // - optional updater wiring can be attached here behind local release channel checks
  // - installer/portable packaging can branch from app.isPackaged + packagingTarget metadata
  // - keep updater optional and local-first friendly (no mandatory account/auth flow)
  ipcMain.handle('godzilla:load-data', async () => readAppData())
  ipcMain.handle('godzilla:save-data', async (_event, value: unknown) =>
    writeAppData(value),
  )
  ipcMain.handle('godzilla:copy-text', async (_event, text: unknown) => {
    if (typeof text !== 'string') {
      return false
    }

    clipboard.writeText(text)
    return true
  })
  ipcMain.handle('godzilla:get-app-info', async () => ({
    appName: 'KCxModeAI',
    appVersion: app.getVersion(),
    dataFilePath: dataFilePath(),
    dataDirectoryPath: app.getPath('userData'),
    isPackaged: app.isPackaged,
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    buildChannel: app.isPackaged ? 'production' : 'development',
    releaseType: app.isPackaged ? 'stable_prep' : 'dev_snapshot',
    environmentStatus: app.isPackaged ? 'packaged_desktop' : 'desktop_shell',
    buildCommit: process.env.BUILD_COMMIT ?? 'local-dev',
    packagingTarget: app.isPackaged
      ? 'desktop_packaged_placeholder'
      : 'desktop_dev',
  }))
  ipcMain.handle('godzilla:get-network-status', async () => getNetworkStatus())
  ipcMain.handle('godzilla:start-private-browser-access', async (_event, config: unknown) =>
    startPrivateBrowserAccess(config),
  )
  ipcMain.handle('godzilla:stop-private-browser-access', async () => stopPrivateBrowserAccess())
  ipcMain.handle('godzilla:get-private-browser-access-status', async () =>
    privateBrowserAccessStatus(),
  )
  ipcMain.handle('godzilla:open-data-folder', async () => {
    const result = await shell.openPath(app.getPath('userData'))
    return result === ''
  })
  ipcMain.handle('godzilla:get-ollama-status', async (_event, url: unknown, selectedModel: unknown) =>
    getOllamaStatus(url, selectedModel),
  )
  ipcMain.handle('godzilla:check-ollama-status', async (_event, baseUrl: unknown) =>
    checkOllamaStatus(baseUrl),
  )
  ipcMain.handle('godzilla:list-ollama-models', async (_event, baseUrl: unknown) =>
    listOllamaModels(baseUrl),
  )
  ipcMain.handle(
    'godzilla:generate-with-ollama',
    async (_event, baseUrl: unknown, model: unknown, prompt: unknown) => {
      console.info(
        '[GodzillaModeAI] IPC stage: ollama_handler_hit',
        JSON.stringify({
          baseUrl: asString(baseUrl),
          model: asString(model),
          promptLength: asString(prompt).length,
        }),
      )
      const result = await generateWithOllama(baseUrl, model, prompt)
      console.info(
        '[GodzillaModeAI] IPC stage: ollama_handler_returning',
        JSON.stringify({
          ok: result.ok,
          message: result.message,
          errorMessage: result.errorMessage ?? '',
          textLength: result.text.length,
        }),
      )
      return result
    },
  )
}

app.whenReady().then(async () => {
  app.setName('GodzillaModeAI')

  if (process.platform === 'win32') {
    app.setAppUserModelId('KCx.GodzillaModeAI')
  }

  registerIpc()
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void stopPrivateBrowserAccess()
})
