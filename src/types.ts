export const memoryCategories = [
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
] as const

export const taskPriorities = ['low', 'normal', 'high'] as const

export const noteTemplates = [
  'blank',
  'meeting_notes',
  'doctor_note',
  'grocery_planning',
  'focus_session',
  'checklist',
] as const

export type MemoryCategory = (typeof memoryCategories)[number]
export type TaskPriority = (typeof taskPriorities)[number]
export type NoteTemplate = (typeof noteTemplates)[number]
export type SafetyLevel = 'normal' | 'caution' | 'urgent' | 'info'

export type ProviderId =
  | 'rule-based'
  | 'ollama'
  | 'openai'
  | 'gemini'
  | 'claude'
export type AiProviderMode = 'rule_based' | 'ollama'
export type AiStatus = 'unavailable' | 'checking' | 'ready' | 'error'

export type BrainIntent =
  | 'blood_sugar'
  | 'a1c'
  | 'health_summary'
  | 'medicine_log'
  | 'symptom_note'
  | 'doctor_report'
  | 'messy_notes'
  | 'shopping_text'
  | 'todo_text'
  | 'focus_support'
  | 'family_support'
  | 'senior_support'
  | 'godzilla_planning'
  | 'general'

export type AppView =
  | 'dashboard'
  | 'chat'
  | 'health'
  | 'notes'
  | 'focus'
  | 'family'
  | 'senior'
  | 'memory'
  | 'settings'

export type NotesWorkflowTab = 'clean' | 'shopping' | 'tasks'
export type ThemePreference = 'godzilla' | 'midnight'
export type MemorySortOrder = 'newest' | 'oldest'
export type MemoryImportance = 'low' | 'normal' | 'important' | 'high'
export type TaskFilterStatus = 'all' | 'active' | 'completed' | 'overdue'
export type DashboardSectionId =
  | 'summary'
  | 'quick_actions'
  | 'productivity'
  | 'recent_activity'
  | 'pinned_widgets'
export type DashboardWidgetId =
  | 'memory'
  | 'tasks'
  | 'conversations'
  | 'focus'
  | 'health'
export type QuickActionId =
  | 'open_chat'
  | 'health_summary'
  | 'persistent_notes'
  | 'memory_review'
  | 'focus_reset'
  | 'global_search'
export type ActivityType =
  | 'memory_saved'
  | 'memory_updated'
  | 'memory_deleted'
  | 'task_completed'
  | 'task_saved'
  | 'conversation_saved'
  | 'conversation_deleted'
  | 'notes_updated'
  | 'settings_saved'
  | 'import_completed'
  | 'export_completed'
  | 'workflow_failed'
  | 'ollama_failed'
  | 'sync_prep_event'
  | 'recovery_event'

export interface SyncMetadata {
  lastModified: string
  syncEligible: boolean
  syncVersion: number
  deviceSource: 'desktop_local' | 'android_future' | 'unknown'
  pendingSync: boolean
  localOnly: boolean
}

export interface StructuredAiResponse {
  type: string
  title: string
  responseText: string
  bullets: string[]
  suggestedActions: string[]
  safetyLevel: SafetyLevel
  memoryUpdates?: string[]
}

export interface MemoryEntry {
  id: string
  category: MemoryCategory
  title: string
  content: string
  source: string
  tags: string[]
  pinned: boolean
  favorite: boolean
  importance: MemoryImportance
  safeForLocalAi: boolean
  archived: boolean
  syncMeta: SyncMetadata
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  response?: StructuredAiResponse
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  messages: ChatMessage[]
}

export interface ProviderSettings {
  preferredProvider: ProviderId
  ollamaUrl: string
  ollamaModel: string
  openAiApiKey: string
  geminiApiKey: string
  claudeApiKey: string
}

export interface OllamaSettings {
  enabled: boolean
  baseUrl: string
  selectedModel: string
  availableModels: string[]
  lastStatus: AiStatus
  lastCheckedAt: string | null
  errorMessage: string
}

export interface LocalAiSettings {
  providerMode: AiProviderMode
  ollama: OllamaSettings
  context: LocalAiContextSettings
}

export interface LocalAiContextSettings {
  contextMode: 'minimal' | 'recent_chat_only' | 'extended_chat'
  maxContextMessages: number
  allowConversationTitles: boolean
  allowTaskContext: boolean
  allowNotesContext: boolean
  allowMemoryHighlights: boolean
}

export interface UiPreferences {
  themePreference: ThemePreference
  sidebarCollapsed: boolean
  lastView: AppView
  memorySearch: string
  memoryCategoryFilter: 'all' | MemoryCategory
  memoryPinnedOnly: boolean
  memoryTagFilter: string
  memoryArchivedOnly: boolean
  memorySortOrder: MemorySortOrder
  notesActiveTab: NotesWorkflowTab
}

export interface HelperPreferences {
  notesRememberDrafts: boolean
  focusPreset: 'quick_reset' | 'deep_work' | 'reentry'
  focusTimerMinutes: number
  familyTemplate: 'calm_boundary' | 'routine_reset' | 'screen_time'
  seniorEasyMode: boolean
}

export interface RemoteAccessSettings {
  mode: 'local_only' | 'hybrid_ready'
  tailscaleEnabled: boolean
  remoteSyncPlanned: boolean
  remoteApiBridgeEnabled: boolean
  remoteAiRequestsEnabled: boolean
  androidCompanionPlanned: boolean
  browserAccessEnabled: boolean
  browserHostMode: 'localhost_only' | 'lan' | 'tailscale'
  browserBindHost: string
  browserPort: number
  localAccessPin: string
  trustedNetworkLabel: string
}

export type AndroidBridgeMode = 'off' | 'local_only' | 'tailscale_ready'

export interface AndroidAllowedDevice {
  id: string
  label: string
}

export interface AndroidPairedDevice {
  id: string
  label: string
  lastSeenAt: string | null
}

export interface AndroidBridgeSettings {
  enabled: boolean
  localBridgePort: number
  bridgeMode: AndroidBridgeMode
  pairingCode: string
  allowedDevices: AndroidAllowedDevice[]
  pairedDevices: AndroidPairedDevice[]
  lastSeenAt: string | null
  syncPreviewLastCheckedAt: string | null
  syncPairingPlaceholder: string
}

export type SyncState = 'inactive' | 'pairing' | 'ready' | 'syncing' | 'error'
export type SyncDirection = 'pc_to_android' | 'android_to_pc' | 'bidirectional'
export type SyncConflictState = 'none' | 'detected' | 'manual_review'
export type SyncTransport = 'lan' | 'localhost_bridge' | 'tailscale'

export interface SyncSession {
  syncSessionId: string
  pairedDeviceId: string
  syncState: SyncState
  lastSyncAt: string | null
  pendingChanges: number
  syncDirection: SyncDirection
  syncConflictState: SyncConflictState
  transport: SyncTransport
  transportAvailable: boolean
  localOnly: true
}

export interface SyncConflictSummary {
  id: string
  entityType: 'memory' | 'task' | 'note' | 'workflow' | 'settings'
  entityId: string
  localVersion: number
  remoteVersion: number
  lastWriteAtLocal: string
  lastWriteAtRemote: string
  summary: string
  requiresManualResolution: true
}

export interface SyncPairingRequestState {
  requestId: string
  status: 'idle' | 'pending' | 'accepted' | 'rejected' | 'revoked'
  requestedAt: string | null
  expiresAt: string | null
}

export interface SyncSettings {
  allowLanSyncPrep: boolean
  allowLocalhostBridgePrep: boolean
  allowTailscaleSyncPrep: boolean
  trustedDevicePlaceholders: AndroidPairedDevice[]
  pairingRequest: SyncPairingRequestState
  lastSyncSessionId: string | null
}

export type ReminderType = 'workflow' | 'task' | 'focus' | 'notes_review'
export type ReminderFrequency = 'none' | 'daily' | 'weekly' | 'monthly'

export interface ReminderItem {
  id: string
  type: ReminderType
  title: string
  enabled: boolean
  remindAt: string
  frequency: ReminderFrequency
  nextReminderAt: string | null
  lastTriggeredAt: string | null
  localOnly: true
}

export interface NotificationSettings {
  enabled: boolean
  desktopNotificationPrep: boolean
  browserNotificationFallback: 'disabled' | 'manual_prompt_only'
  reminders: ReminderItem[]
}

export interface BackupMetadata {
  createdAt: string
  exportVersion: string
  deviceName: string
  appVersion: string
  localOnlyExport: true
}

export interface ReleaseSettings {
  buildChannel: 'development' | 'production'
  releaseType: 'dev_snapshot' | 'beta_prep' | 'stable_prep'
  environmentStatus: 'browser_fallback' | 'desktop_shell' | 'packaged_desktop'
  packagingPrep: {
    installerReadyPlaceholder: boolean
    portableModeReadyPlaceholder: boolean
    optionalUpdaterPlanned: boolean
  }
}

export interface SecuritySettings {
  encryptionPrep: {
    encryptedLocalExportPlanned: boolean
    encryptedSyncPayloadPlanned: boolean
    encryptedMemoryCategoriesPlanned: boolean
    securePairingPlanned: boolean
  }
  partitioning: {
    healthSensitiveCategories: MemoryCategory[]
    familySeniorSensitiveCategories: MemoryCategory[]
    localAiSafeOnlyVisibility: boolean
    exportSafeOnlyVisibility: boolean
    syncEligibleOnlyVisibility: boolean
  }
  localOnlyIndicatorsEnabled: boolean
}

export interface TesterSettings {
  feedback: {
    testerNotes: string
    bugReportDraft: string
    localFeedbackQueue: string[]
  }
  debugTools: {
    compactResetPrepEnabled: boolean
    safeCacheClearPrepEnabled: boolean
    workflowResetPrepEnabled: boolean
    importExportValidationPrepEnabled: boolean
  }
}

export interface AccessibilitySettings {
  largerText: boolean
  higherContrast: boolean
  keyboardNavigationPrep: boolean
  simplifiedWording: boolean
}

export interface AndroidEcosystemSettings {
  sharedWorkflowSyncPrep: boolean
  sharedNotesTasksSummaryPrep: boolean
  sharedFocusSessionsPrep: boolean
  sharedFamilySeniorSummaryPrep: boolean
  aiSafeMemorySyncPreviewPrep: boolean
}

export interface AppSettings {
  localFirst: boolean
  providerSettings: ProviderSettings
  uiPreferences: UiPreferences
  helperPreferences: HelperPreferences
  remoteAccess: RemoteAccessSettings
  androidBridge: AndroidBridgeSettings
  sync: SyncSettings
  notifications: NotificationSettings
  release: ReleaseSettings
  security: SecuritySettings
  tester: TesterSettings
  accessibility: AccessibilitySettings
  androidEcosystem: AndroidEcosystemSettings
  localAi: LocalAiSettings
}

export interface ChecklistItem {
  id: string
  label: string
  completed: boolean
}

export interface TaskItem {
  id: string
  label: string
  completed: boolean
  dueDate: string | null
  priority: TaskPriority
  category: string
  pinned: boolean
  syncMeta: SyncMetadata
  createdAt: string
  updatedAt: string
}

export interface NotesWorkflowState {
  input: string
  cleanText: string
  shoppingItems: ChecklistItem[]
  taskItems: TaskItem[]
  taskSearch: string
  taskFilterStatus: TaskFilterStatus
  taskFilterCategory: string
  template: NoteTemplate
  updatedAt: string | null
}

export interface ChatWorkflowState {
  conversations: Conversation[]
  activeConversationId: string | null
}

export interface DashboardWorkflowState {
  collapsedSections: DashboardSectionId[]
  pinnedWidgets: DashboardWidgetId[]
  quickActionIds: QuickActionId[]
}

export type WorkflowTrigger = 'manual'
export type WorkflowCategory =
  | 'morning_routine'
  | 'focus_session'
  | 'daily_planning'
  | 'wind_down'
  | 'notes_cleanup'
  | 'custom'
export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed'
export type WorkflowStepType = 'checklist' | 'prompt' | 'timer' | 'review'

export interface WorkflowStep {
  id: string
  title: string
  detail: string
  type: WorkflowStepType
  delaySeconds?: number
}

export interface WorkflowRoutine {
  id: string
  name: string
  description: string
  category: WorkflowCategory
  trigger: WorkflowTrigger
  enabled: boolean
  status: WorkflowStatus
  lastRunAt: string | null
  syncMeta: SyncMetadata
  steps: WorkflowStep[]
}

export interface WorkflowRuntimeState {
  activeRoutineId: string | null
  status: WorkflowStatus
  message: string
  updatedAt: string | null
}

export interface ActivityEntry {
  id: string
  type: ActivityType
  title: string
  detail: string
  entityId?: string
  createdAt: string
}

export interface AppWorkflows {
  notes: NotesWorkflowState
  chat: ChatWorkflowState
  dashboard: DashboardWorkflowState
  syncSessions: SyncSession[]
  syncConflicts: SyncConflictSummary[]
  routines: WorkflowRoutine[]
  reminders: ReminderItem[]
  routineRuntime: WorkflowRuntimeState
  activityLog: ActivityEntry[]
}

export interface AppData {
  memory: MemoryEntry[]
  settings: AppSettings
  workflows: AppWorkflows
}

export interface AppInfo {
  appName: string
  appVersion: string
  dataFilePath: string
  dataDirectoryPath: string
  isPackaged: boolean
  platform: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  buildChannel: 'development' | 'production'
  releaseType: 'dev_snapshot' | 'beta_prep' | 'stable_prep'
  environmentStatus: 'browser_fallback' | 'desktop_shell' | 'packaged_desktop'
  buildCommit: string
  packagingTarget: 'desktop_dev' | 'desktop_packaged_placeholder'
}

export interface NetworkStatus {
  localhostStatus: 'online' | 'offline'
  localNetworkIp: string | null
  tailscaleDetected: boolean
  tailscaleRunning: boolean
  tailscaleIp: string | null
  readinessStatus: 'local_only' | 'hybrid_ready' | 'remote_ready_partial'
  checkedAt: string
  notes: string[]
}

export interface PrivateBrowserAccessConfig {
  browserHostMode: 'localhost_only' | 'lan' | 'tailscale'
  browserPort: number
}

export interface PrivateBrowserAccessStatus {
  status: 'stopped' | 'starting' | 'running' | 'failed'
  available: boolean
  host: string
  port: number
  localhostUrl: string | null
  lanUrl: string | null
  tailscaleUrl: string | null
  message: string
}

export interface OllamaModelSummary {
  name: string
}

export interface OllamaStatus {
  available: boolean
  url: string
  models: OllamaModelSummary[]
  selectedModelAvailable: boolean
  selectedModel: string
  message: string
  checkedAt: string
  desktopBridgeRequired: boolean
}

export interface OllamaCheckResponse {
  status: AiStatus
  baseUrl: string
  reachable: boolean
  message: string
  checkedAt: string
  errorMessage?: string
}

export interface OllamaModelsResponse {
  status: AiStatus
  baseUrl: string
  models: string[]
  message: string
  checkedAt: string
  errorMessage?: string
}

export interface OllamaGenerateResponse {
  ok: boolean
  text: string
  model: string
  baseUrl: string
  message: string
  errorMessage?: string
}

export interface AndroidBridgeBaseRequest {
  requestId: string
  deviceId: string
  sentAt: string
}

export interface AndroidHealthSummaryRequest extends AndroidBridgeBaseRequest {
  type: 'health_summary'
  input: string
}

export interface AndroidNoteCleanupRequest extends AndroidBridgeBaseRequest {
  type: 'note_cleanup'
  input: string
}

export interface AndroidTaskExtractionRequest extends AndroidBridgeBaseRequest {
  type: 'task_extraction'
  input: string
}

export interface AndroidMemorySyncRequest extends AndroidBridgeBaseRequest {
  type: 'memory_sync'
  memoryCursor?: string
}

export interface AndroidFocusHelperRequest extends AndroidBridgeBaseRequest {
  type: 'focus_helper'
  input: string
}

export interface AndroidSeniorHelperRequest extends AndroidBridgeBaseRequest {
  type: 'senior_helper'
  input: string
}

export type AndroidBridgeRequest =
  | AndroidHealthSummaryRequest
  | AndroidNoteCleanupRequest
  | AndroidTaskExtractionRequest
  | AndroidMemorySyncRequest
  | AndroidFocusHelperRequest
  | AndroidSeniorHelperRequest

export interface AndroidBridgeStatusResponse {
  ok: boolean
  status: 'off' | 'placeholder' | 'ready'
  bridgeMode: AndroidBridgeMode
  enabled: boolean
  message: string
  checkedAt: string
}

export interface AndroidBridgeHelperResponse {
  ok: boolean
  response?: StructuredAiResponse
  message: string
}
