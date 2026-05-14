import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import './App.css'
import { createDefaultAppData, defaultAppInfo } from './lib/defaults'
import { GodzillaAiBrain } from './lib/godzillaBrain'
import { canUseOllamaForChat, isSelectedOllamaModelAvailable } from './lib/localAi'
import { buildSafeLocalAiContext } from './lib/localAiContext'
import { runWorkflowRoutine } from './lib/workflowEngine'
import {
  checkOllamaStatus,
  copyText,
  generateWithOllama,
  getAppInfo,
  getOllamaStatus,
  getNetworkStatus,
  getPrivateBrowserAccessStatus,
  listOllamaModels,
  loadAppData,
  openDataFolder,
  saveAppData,
  startPrivateBrowserAccess,
  stopPrivateBrowserAccess,
} from './lib/storage'
import { memoryCategories } from './types'
import type {
  ActivityType,
  AndroidBridgeSettings,
  AppData,
  AppInfo,
  AppView,
  BrainIntent,
  ChecklistItem,
  Conversation,
  DashboardSectionId,
  DashboardWidgetId,
  MemoryCategory,
  MemoryEntry,
  MemoryImportance,
  MemorySortOrder,
  NetworkStatus,
  NoteTemplate,
  OllamaModelsResponse,
  NotesWorkflowState,
  NotesWorkflowTab,
  OllamaStatus,
  PrivateBrowserAccessStatus,
  QuickActionId,
  ReminderItem,
  StructuredAiResponse,
  TaskFilterStatus,
  TaskItem,
  TaskPriority,
  ThemePreference,
  WorkflowRoutine,
} from './types'

type ToastTone = 'info' | 'success' | 'warning'

type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

type HealthBundle = {
  summary: StructuredAiResponse | null
  bloodSugar: StructuredAiResponse | null
  medicine: StructuredAiResponse | null
  symptom: StructuredAiResponse | null
  doctor: StructuredAiResponse | null
}

type MemoryDraft = {
  id: string
  title: string
  content: string
  category: MemoryCategory
  source: string
  tags: string
  pinned: boolean
  favorite: boolean
  importance: MemoryImportance
  safeForLocalAi: boolean
  archived: boolean
}

type SettingsDraft = {
  localFirst: boolean
  remoteAccess: AppData['settings']['remoteAccess']
  androidBridge: AndroidBridgeSettings
  sync: AppData['settings']['sync']
  notifications: AppData['settings']['notifications']
  release: AppData['settings']['release']
  security: AppData['settings']['security']
  tester: AppData['settings']['tester']
  accessibility: AppData['settings']['accessibility']
  androidEcosystem: AppData['settings']['androidEcosystem']
  localAi: AppData['settings']['localAi']
  notesRememberDrafts: boolean
}

type SearchResult = {
  id: string
  title: string
  detail: string
  type: 'memory' | 'task' | 'note' | 'conversation'
  action: () => void
}

const brain = new GodzillaAiBrain()
const providerCatalog = brain.getProviderCatalog()
const providerModeOptions: AppData['settings']['localAi']['providerMode'][] = [
  'rule_based',
  'ollama',
]
const defaultDataSnapshot = createDefaultAppData()

const views: Array<{ id: AppView; label: string; short: string; compact: string }> = [
  { id: 'dashboard', label: 'Dashboard', short: 'Overview and status', compact: 'DB' },
  { id: 'chat', label: 'Chat Assistant', short: 'Saved local conversations', compact: 'CH' },
  { id: 'health', label: 'Health Helper', short: 'Safe note organization', compact: 'HL' },
  { id: 'notes', label: 'Notes Helper', short: 'Persistent notes and tasks', compact: 'NT' },
  { id: 'focus', label: 'Focus Helper', short: 'Reduce distraction friction', compact: 'FC' },
  { id: 'family', label: 'Family Helper', short: 'Calm wording and structure', compact: 'FM' },
  { id: 'senior', label: 'Senior Helper', short: 'Simplify technical steps', compact: 'SR' },
  { id: 'memory', label: 'Memory Manager', short: 'Richer local memory', compact: 'MM' },
  { id: 'settings', label: 'Settings', short: 'Local tools and data safety', compact: 'ST' },
]

const viewDetails: Record<
  AppView,
  { description: string; hint: string; shortcut?: string }
> = {
  dashboard: {
    description:
      'Monitor workflow status, customize dashboard behavior, and see the most important productivity signals.',
    hint: 'Sections, widgets, and quick actions are now remembered locally.',
  },
  chat: {
    description:
      'Use the local rule-based assistant inside saved conversations with rename, delete, export, and recent-history support.',
    hint: 'Chat history is grouped into persistent local conversations.',
    shortcut: 'Ctrl+Enter sends the current message.',
  },
  health: {
    description:
      'Organize raw health notes into safer structured outputs for readings, patterns, medicine notes, symptoms, doctor-ready notes, and safety wording.',
    hint: 'This is organization help only. It does not diagnose or prescribe.',
    shortcut: 'Ctrl+Enter runs the health summary.',
  },
  notes: {
    description:
      'Turn messy notes into an editable workflow with templates, shopping items, advanced tasks, and persistent planning support.',
    hint: 'Tasks now support due dates, priority, category, pinning, filtering, and bulk actions.',
    shortcut: 'Ctrl+Enter analyzes the current note.',
  },
  focus: {
    description:
      'Get short supportive coaching, delay/friction ideas, and practical focus session planning help.',
    hint: 'Use this as a reset tool when attention slips, not a giant productivity suite.',
    shortcut: 'Ctrl+Enter runs focus coaching.',
  },
  family: {
    description:
      'Draft calmer wording for family rules, conflict moments, and kid-safe device structure decisions.',
    hint: 'Short, consistent wording usually works better than complicated scripts.',
    shortcut: 'Ctrl+Enter generates guidance.',
  },
  senior: {
    description:
      'Simplify technical instructions into clearer, safety-first steps for older adults.',
    hint: 'One device, one task, one confirmation step at a time.',
    shortcut: 'Ctrl+Enter simplifies the instructions.',
  },
  memory: {
    description:
      'Review, edit, pin, favorite, tag, expand, search, and group local memory entries with rule-based suggestions.',
    hint: 'Related memory suggestions and duplicate warnings are computed locally.',
  },
  settings: {
    description:
      'Manage local-first preferences, future provider placeholders, theme, backup/export, import, and app safety details.',
    hint: 'All workflow state remains local and recoverable through JSON export and import.',
  },
}

const helperExamples = {
  health:
    'Blood sugar 68 before lunch, shaky and tired, took juice, later 112. Metformin 500mg in the morning. Need a clean summary for my doctor.',
  notes:
    'buy milk, eggs, call pharmacy, reminder for Monday, bananas, send school email, paper towels',
  focus:
    'I keep drifting to my phone and random tabs when I try to work.',
  family:
    'Need calm wording for a family rule about device time after homework.',
  senior:
    'How to sign in to the patient portal and find the latest lab result.',
}

const androidSyncPreviewCategories = [
  'Health logs',
  'Notes',
  'Tasks',
  'Focus routines',
  'Senior Mode settings',
  'Family Mode wording',
  'Memory highlights',
]

const safetyTone: Record<StructuredAiResponse['safetyLevel'], string> = {
  normal: 'Stable',
  caution: 'Use care',
  urgent: 'Urgent flag',
  info: 'Info',
}

const availableQuickActions: Array<{
  id: QuickActionId
  label: string
  detail: string
  view?: AppView
}> = [
  { id: 'open_chat', label: 'Open Chat', detail: 'Jump into saved conversations.', view: 'chat' },
  {
    id: 'health_summary',
    label: 'Health Summary',
    detail: 'Open the health helper with structured safe summaries.',
    view: 'health',
  },
  {
    id: 'persistent_notes',
    label: 'Persistent Notes',
    detail: 'Open the notes workflow with editable tasks and lists.',
    view: 'notes',
  },
  {
    id: 'memory_review',
    label: 'Memory Review',
    detail: 'Open the richer memory manager.',
    view: 'memory',
  },
  {
    id: 'focus_reset',
    label: 'Focus Reset',
    detail: 'Open the focus helper for a quick reset.',
    view: 'focus',
  },
  {
    id: 'global_search',
    label: 'Global Search',
    detail: 'Search memory, tasks, notes, and conversations.',
  },
]

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const nowIso = () => new Date().toISOString()
const createSyncMeta = () => ({
  lastModified: nowIso(),
  syncEligible: true,
  syncVersion: 1,
  deviceSource: 'desktop_local' as const,
  pendingSync: false,
  localOnly: true,
})

const formatDate = (value: string) =>
  new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const summarizeText = (value: string, limit = 220) =>
  value.length > limit ? `${value.slice(0, limit - 3).trim()}...` : value

const tagsToString = (tags: string[]) => tags.join(', ')

const parseTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12)

const responseToMemoryText = (response: StructuredAiResponse) =>
  [
    `# ${response.title}`,
    '',
    response.responseText,
    '',
    ...response.bullets.map((bullet) => `- ${bullet}`),
    '',
    ...response.suggestedActions.map((item) => `[ ] ${item}`),
  ]
    .filter(Boolean)
    .join('\n')

const responseToCopyText = (response: StructuredAiResponse) =>
  [
    response.title,
    response.responseText,
    '',
    ...response.bullets.map((bullet) => `- ${bullet}`),
    '',
    ...response.suggestedActions.map((item) => `Next: ${item}`),
  ].join('\n')

const extractLabeledBullet = (
  response: StructuredAiResponse | null,
  label: string,
  fallback: string,
) => {
  if (!response) {
    return fallback
  }

  const prefix = `${label}:`
  const match = response.bullets.find((bullet) => bullet.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : fallback
}

const createChecklistItem = (label = ''): ChecklistItem => ({
  id: createId(),
  label,
  completed: false,
})

const createTaskItem = (label = ''): TaskItem => {
  const stamp = nowIso()
  return {
    id: createId(),
    label,
    completed: false,
    dueDate: null,
    priority: 'normal',
    category: 'general',
    pinned: false,
    syncMeta: createSyncMeta(),
    createdAt: stamp,
    updatedAt: stamp,
  }
}

const createReminderItem = (title = 'Local reminder'): ReminderItem => {
  const remindAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  return {
    id: createId(),
    type: 'workflow',
    title,
    enabled: true,
    remindAt,
    frequency: 'none',
    nextReminderAt: remindAt,
    lastTriggeredAt: null,
    localOnly: true,
  }
}

const createMemoryDraft = (entry: MemoryEntry): MemoryDraft => ({
  id: entry.id,
  title: entry.title,
  content: entry.content,
  category: entry.category,
  source: entry.source,
  tags: tagsToString(entry.tags),
  pinned: entry.pinned,
  favorite: entry.favorite,
  importance: entry.importance,
  safeForLocalAi: entry.safeForLocalAi,
  archived: entry.archived,
})

const emptyHealthBundle = (): HealthBundle => ({
  summary: null,
  bloodSugar: null,
  medicine: null,
  symptom: null,
  doctor: null,
})

const defaultNetworkStatus = (): NetworkStatus => ({
  localhostStatus: 'online',
  localNetworkIp: null,
  tailscaleDetected: false,
  tailscaleRunning: false,
  tailscaleIp: null,
  readinessStatus: 'local_only',
  checkedAt: new Date().toISOString(),
  notes: [],
})

const defaultPrivateBrowserAccessStatus = (): PrivateBrowserAccessStatus => ({
  status: 'stopped',
  available: Boolean(window.godzillaAPI),
  host: '127.0.0.1',
  port: 4173,
  localhostUrl: null,
  lanUrl: null,
  tailscaleUrl: null,
  message: window.godzillaAPI
    ? 'Private browser access is stopped.'
    : 'Private browser access controls require the desktop shell.',
})

const defaultOllamaStatus = (): OllamaStatus => ({
  available: false,
  url: defaultDataSnapshot.settings.localAi.ollama.baseUrl,
  models: [],
  selectedModelAvailable: false,
  selectedModel: '',
  message: 'Not checked yet.',
  checkedAt: new Date().toISOString(),
  desktopBridgeRequired: !window.godzillaAPI,
})

const buildNotesExportText = (workflow: NotesWorkflowState) =>
  [
    '# Clean Notes',
    workflow.cleanText || 'No clean notes generated yet.',
    '',
    '# Shopping List',
    ...(workflow.shoppingItems.length > 0
      ? workflow.shoppingItems.map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.label}`)
      : ['No shopping items yet.']),
    '',
    '# Task List',
    ...(workflow.taskItems.length > 0
      ? workflow.taskItems.map(
          (item) =>
            `${item.completed ? '[x]' : '[ ]'} ${item.label} | priority: ${item.priority} | category: ${item.category}${item.dueDate ? ` | due: ${item.dueDate}` : ''}`,
        )
      : ['No tasks yet.']),
  ].join('\n')

const buildConversationExportText = (conversation: Conversation) =>
  [
    `# ${conversation.title}`,
    `Created: ${conversation.createdAt}`,
    `Updated: ${conversation.updatedAt}`,
    '',
    ...conversation.messages.flatMap((message) => [
      `## ${message.role === 'user' ? 'You' : 'KCxModeAI'} - ${message.createdAt}`,
      message.response ? responseToCopyText(message.response) : message.content,
      '',
    ]),
  ].join('\n')

const isImportPayloadShapeSafe = (value: unknown): value is Partial<AppData> =>
  typeof value === 'object' && value !== null

const startOfToday = () => {
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  return value
}

const isOverdueTask = (task: TaskItem) =>
  Boolean(
    task.dueDate &&
      !task.completed &&
      new Date(`${task.dueDate}T23:59:59`).getTime() < startOfToday().getTime(),
  )

const detectMemoryCategorySuggestion = (
  title: string,
  content: string,
): MemoryCategory => {
  const text = `${title} ${content}`.toLowerCase()

  if (/glucose|blood sugar|a1c|mg\/dl|low|high/.test(text)) {
    return 'blood_sugar'
  }

  if (/medicine|medication|dose|metformin|insulin|pill/.test(text)) {
    return 'medicine'
  }

  if (/symptom|pain|nausea|dizzy|shaky|fatigue/.test(text)) {
    return 'symptom'
  }

  if (/buy |grocery|shopping|store|milk|eggs|bananas/.test(text)) {
    return 'shopping'
  }

  if (/task|todo|reminder|call |send |schedule /.test(text)) {
    return 'task'
  }

  if (/focus|godzilla mode|deep work|routine|friction/.test(text)) {
    return 'godzilla_mode_setting'
  }

  return 'note'
}

const applyNotesTemplate = (template: NoteTemplate) => {
  switch (template) {
    case 'meeting_notes':
      return `# Meeting Notes\n\nAttendees:\n- \n\nKey points:\n- \n\nDecisions:\n- \n\nAction items:\n- `
    case 'doctor_note':
      return `# Doctor Note\n\nReason for visit:\n- \n\nSymptoms:\n- \n\nReadings:\n- \n\nMedicines:\n- \n\nQuestions:\n- `
    case 'grocery_planning':
      return `# Grocery Planning\n\nMeals:\n- \n\nStaples:\n- \n\nShopping items:\n- `
    case 'focus_session':
      return `# Focus Session Plan\n\nTarget result:\n- \n\nBlock length:\n- \n\nDistraction friction:\n- \n\nNext action:\n- `
    case 'checklist':
      return `# Checklist\n\n- \n- \n- `
    default:
      return ''
  }
}

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>('godzilla')
  const [memorySearch, setMemorySearch] = useState('')
  const [memoryFilter, setMemoryFilter] = useState<'all' | MemoryCategory>('all')
  const [memoryPinnedOnly, setMemoryPinnedOnly] = useState(false)
  const [memoryTagFilter, setMemoryTagFilter] = useState('')
  const [memoryArchivedOnly, setMemoryArchivedOnly] = useState(false)
  const [memorySortOrder, setMemorySortOrder] = useState<MemorySortOrder>('newest')
  const [notesTab, setNotesTab] = useState<NotesWorkflowTab>('clean')

  const [appData, setAppData] = useState<AppData>(() => createDefaultAppData())
  const [appInfo, setAppInfo] = useState<AppInfo>(defaultAppInfo)
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() =>
    defaultNetworkStatus(),
  )
  const [privateBrowserAccessStatus, setPrivateBrowserAccessStatus] =
    useState<PrivateBrowserAccessStatus>(() => defaultPrivateBrowserAccessStatus())
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>(() =>
    defaultOllamaStatus(),
  )
  const [testingOllama, setTestingOllama] = useState(false)
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [chatRuntimeStatus, setChatRuntimeStatus] = useState('Rule-based active')
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Loading local data...')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const [composer, setComposer] = useState('')
  const [healthInput, setHealthInput] = useState(helperExamples.health)
  const [healthBundle, setHealthBundle] = useState<HealthBundle>(() => emptyHealthBundle())
  const [notesWorkflow, setNotesWorkflow] = useState<NotesWorkflowState>(
    defaultDataSnapshot.workflows.notes,
  )
  const [focusInput, setFocusInput] = useState(helperExamples.focus)
  const [focusResult, setFocusResult] = useState<StructuredAiResponse | null>(null)
  const [focusCompletionSummary, setFocusCompletionSummary] = useState('')
  const [familyInput, setFamilyInput] = useState(helperExamples.family)
  const [familyResult, setFamilyResult] = useState<StructuredAiResponse | null>(null)
  const [seniorInput, setSeniorInput] = useState(helperExamples.senior)
  const [seniorResult, setSeniorResult] = useState<StructuredAiResponse | null>(null)
  const [focusPreset, setFocusPreset] =
    useState<AppData['settings']['helperPreferences']['focusPreset']>('quick_reset')
  const [focusTimerMinutes, setFocusTimerMinutes] = useState(25)
  const [familyTemplate, setFamilyTemplate] =
    useState<AppData['settings']['helperPreferences']['familyTemplate']>('calm_boundary')
  const [seniorEasyMode, setSeniorEasyMode] = useState(false)

  const [manualMemoryTitle, setManualMemoryTitle] = useState('')
  const [manualMemoryContent, setManualMemoryContent] = useState('')
  const [manualMemoryCategory, setManualMemoryCategory] =
    useState<MemoryCategory>('note')
  const [manualMemorySource, setManualMemorySource] = useState('manual_entry')
  const [manualMemoryTags, setManualMemoryTags] = useState('')
  const [manualMemoryPinned, setManualMemoryPinned] = useState(false)
  const [manualMemoryFavorite, setManualMemoryFavorite] = useState(false)
  const [manualMemoryImportance, setManualMemoryImportance] =
    useState<MemoryImportance>('normal')
  const [manualMemorySafeForLocalAi, setManualMemorySafeForLocalAi] = useState(false)
  const [manualMemoryArchived, setManualMemoryArchived] = useState(false)
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)

  const [expandedMemoryIds, setExpandedMemoryIds] = useState<string[]>([])
  const [editingMemory, setEditingMemory] = useState<MemoryDraft | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    localFirst: true,
    remoteAccess: defaultDataSnapshot.settings.remoteAccess,
    androidBridge: defaultDataSnapshot.settings.androidBridge,
    sync: defaultDataSnapshot.settings.sync,
    notifications: defaultDataSnapshot.settings.notifications,
    release: defaultDataSnapshot.settings.release,
    security: defaultDataSnapshot.settings.security,
    tester: defaultDataSnapshot.settings.tester,
    accessibility: defaultDataSnapshot.settings.accessibility,
    androidEcosystem: defaultDataSnapshot.settings.androidEcosystem,
    localAi: defaultDataSnapshot.settings.localAi,
    notesRememberDrafts: true,
  })
  const [editingConversationTitle, setEditingConversationTitle] = useState('')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const appDataRef = useRef(appData)
  const persistTimerRef = useRef<number | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    appDataRef.current = appData
  }, [appData])

  useEffect(() => {
    if (selectedWorkflowId && appData.workflows.routines.some((item) => item.id === selectedWorkflowId)) {
      return
    }
    setSelectedWorkflowId(appData.workflows.routines[0]?.id ?? null)
  }, [appData.workflows.routines, selectedWorkflowId])

  const applyLoadedData = (loadedData: AppData, loadedInfo?: AppInfo) => {
    setAppData(loadedData)
    if (loadedInfo) {
      setAppInfo(loadedInfo)
    }
    setActiveView(loadedData.settings.uiPreferences.lastView)
    setSidebarCollapsed(loadedData.settings.uiPreferences.sidebarCollapsed)
    setThemePreference(loadedData.settings.uiPreferences.themePreference)
    setMemorySearch(loadedData.settings.uiPreferences.memorySearch)
    setMemoryFilter(loadedData.settings.uiPreferences.memoryCategoryFilter)
    setMemoryPinnedOnly(loadedData.settings.uiPreferences.memoryPinnedOnly)
    setMemoryTagFilter(loadedData.settings.uiPreferences.memoryTagFilter)
    setMemoryArchivedOnly(loadedData.settings.uiPreferences.memoryArchivedOnly)
    setMemorySortOrder(loadedData.settings.uiPreferences.memorySortOrder)
    setNotesTab(loadedData.settings.uiPreferences.notesActiveTab)
    setNotesWorkflow(
      loadedData.settings.helperPreferences.notesRememberDrafts
        ? loadedData.workflows.notes
        : {
            ...defaultDataSnapshot.workflows.notes,
            input: helperExamples.notes,
          },
    )
    setSettingsDraft({
      localFirst: loadedData.settings.localFirst,
      remoteAccess: loadedData.settings.remoteAccess,
      androidBridge: loadedData.settings.androidBridge,
      sync: loadedData.settings.sync,
      notifications: loadedData.settings.notifications,
      release: loadedData.settings.release,
      security: loadedData.settings.security,
      tester: loadedData.settings.tester,
      accessibility: loadedData.settings.accessibility,
      androidEcosystem: loadedData.settings.androidEcosystem,
      localAi: loadedData.settings.localAi,
      notesRememberDrafts: loadedData.settings.helperPreferences.notesRememberDrafts,
    })
    setFocusPreset(loadedData.settings.helperPreferences.focusPreset)
    setFocusTimerMinutes(loadedData.settings.helperPreferences.focusTimerMinutes)
    setFamilyTemplate(loadedData.settings.helperPreferences.familyTemplate)
    setSeniorEasyMode(loadedData.settings.helperPreferences.seniorEasyMode)
    const activeConversation = loadedData.workflows.chat.conversations.find(
      (conversation) => conversation.id === loadedData.workflows.chat.activeConversationId,
    )
    setEditingConversationTitle(activeConversation?.title ?? '')
  }

  const updateLocalAiDraft = (
    updater: (current: SettingsDraft['localAi']) => SettingsDraft['localAi'],
  ) => {
    setSettingsDraft((current) => ({
      ...current,
      localAi: updater(current.localAi),
    }))
  }

  const updateOllamaDraft = (
    updater: (
      current: SettingsDraft['localAi']['ollama'],
    ) => SettingsDraft['localAi']['ollama'],
  ) => {
    updateLocalAiDraft((current) => ({
      ...current,
      ollama: updater(current.ollama),
    }))
  }

  const updateLocalAiContextDraft = (
    updater: (
      current: SettingsDraft['localAi']['context'],
    ) => SettingsDraft['localAi']['context'],
  ) => {
    updateLocalAiDraft((current) => ({
      ...current,
      context: updater(current.context),
    }))
  }

  const refreshNetworkStatus = async (showToast = false) => {
    try {
      const status = await getNetworkStatus()
      setNetworkStatus(status)
      if (showToast) {
        updateStatus('Network status refreshed.', 'success', true)
      }
    } catch {
      if (showToast) {
        updateStatus('Unable to refresh network status.', 'warning', true)
      }
    }
  }

  const refreshPrivateBrowserAccessStatus = async (showToast = false) => {
    const status = await getPrivateBrowserAccessStatus()
    setPrivateBrowserAccessStatus(status)
    if (showToast) {
      updateStatus(status.message, status.status === 'failed' ? 'warning' : 'info', true)
    }
    return status
  }

  const handleStartPrivateBrowserAccess = async () => {
    if (!settingsDraft.remoteAccess.browserAccessEnabled) {
      updateStatus(
        'Enable private-network browser access in Settings before starting.',
        'warning',
        true,
      )
      return
    }
    setPrivateBrowserAccessStatus((current) => ({
      ...current,
      status: 'starting',
      message: 'Starting private browser access...',
    }))
    const status = await startPrivateBrowserAccess({
      browserHostMode: settingsDraft.remoteAccess.browserHostMode,
      browserPort: settingsDraft.remoteAccess.browserPort,
    })
    setPrivateBrowserAccessStatus(status)
    updateStatus(status.message, status.status === 'failed' ? 'warning' : 'success', true)
  }

  const handleStopPrivateBrowserAccess = async () => {
    const status = await stopPrivateBrowserAccess()
    setPrivateBrowserAccessStatus(status)
    updateStatus(status.message, 'info', true)
  }

  const refreshOllamaStatus = async (
    baseUrl: string,
    selectedModel: string,
    showToast = false,
  ) => {
    setTestingOllama(true)
    try {
      const [checkResult, modelResult, status] = await Promise.all([
        checkOllamaStatus(baseUrl),
        listOllamaModels(baseUrl),
        getOllamaStatus(baseUrl, selectedModel),
      ])
      setOllamaStatus(status)
      const modelList =
        modelResult.status === 'ready' ? modelResult.models : ([] as OllamaModelsResponse['models'])
      const nextSelectedModel =
        selectedModel && modelList.includes(selectedModel) ? selectedModel : ''
      setSettingsDraft((current) => ({
        ...current,
        localAi: {
          ...current.localAi,
          ollama: {
            ...current.localAi.ollama,
            baseUrl: checkResult.baseUrl,
            availableModels: modelList,
            lastStatus: checkResult.status,
            lastCheckedAt: checkResult.checkedAt,
            errorMessage: checkResult.errorMessage ?? '',
            selectedModel: nextSelectedModel,
          },
        },
      }))
      if (showToast) {
        const message =
          status.available && modelList.length === 0
            ? 'Ollama is reachable, but no local models were found.'
            : status.message
        updateStatus(message, status.available ? 'success' : 'warning', true)
      }
      return status
    } catch {
      const fallback: OllamaStatus = {
        available: false,
        url: baseUrl,
        models: [],
        selectedModelAvailable: false,
        selectedModel,
        message: 'Unable to reach Ollama.',
        checkedAt: new Date().toISOString(),
        desktopBridgeRequired: !window.godzillaAPI,
      }
      setOllamaStatus(fallback)
      setSettingsDraft((current) => ({
        ...current,
        localAi: {
          ...current.localAi,
          ollama: {
            ...current.localAi.ollama,
            lastStatus: 'error',
            lastCheckedAt: fallback.checkedAt,
            errorMessage: 'Unable to reach Ollama.',
            availableModels: [],
          },
        },
      }))
      if (showToast) {
        updateStatus('Unable to reach Ollama.', 'warning', true)
      }
      void updateAppData(
        (current) =>
          recordActivity(
            current,
            'ollama_failed',
            'Ollama check failed',
            'Unable to reach local Ollama endpoint.',
          ),
        '',
        'info',
        false,
        true,
      )
      return fallback
    } finally {
      setTestingOllama(false)
    }
  }

  useEffect(() => {
    let active = true

    const initialize = async () => {
      try {
        const [loadedData, loadedInfo, loadedNetwork] = await Promise.all([
          loadAppData(),
          getAppInfo(),
          getNetworkStatus(),
        ])

        if (!active) {
          return
        }

        applyLoadedData(loadedData, loadedInfo)
        setNetworkStatus(loadedNetwork)
        const loadedPrivateBrowserAccessStatus = await getPrivateBrowserAccessStatus()
        if (active) {
          setPrivateBrowserAccessStatus(loadedPrivateBrowserAccessStatus)
        }
        const initialOllamaStatus = await getOllamaStatus(
          loadedData.settings.localAi.ollama.baseUrl,
          loadedData.settings.localAi.ollama.selectedModel,
        )
        if (active) {
          setOllamaStatus(initialOllamaStatus)
        }
        setStatusMessage('Local JSON storage ready.')
        setHydrated(true)
      } catch {
        if (active) {
          setStatusMessage('Using fallback local session data.')
          setHydrated(true)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = themePreference
  }, [themePreference])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [appData.workflows.chat.activeConversationId, appData.workflows.chat.conversations, activeView])

  useEffect(() => {
    const handleGlobalKeys = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
        setGlobalSearchOpen(false)
        setShortcutsOpen(false)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setGlobalSearchOpen(true)
        setCommandPaletteOpen(false)
        setShortcutsOpen(false)
      }

      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      }

      if (event.key === 'Escape') {
        setEditingMemory(null)
        setCommandPaletteOpen(false)
        setGlobalSearchOpen(false)
        setShortcutsOpen(false)
      }
    }

    window.addEventListener('keydown', handleGlobalKeys)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeys)
    }
  }, [])

  const composeAppData = (base: AppData): AppData => ({
    ...base,
    settings: {
      ...base.settings,
      release: {
        ...base.settings.release,
        environmentStatus: window.godzillaAPI
          ? appInfo.isPackaged
            ? 'packaged_desktop'
            : 'desktop_shell'
          : 'browser_fallback',
      },
      uiPreferences: {
        ...base.settings.uiPreferences,
        themePreference,
        sidebarCollapsed,
        lastView: activeView,
        memorySearch,
        memoryCategoryFilter: memoryFilter,
        memoryPinnedOnly,
        memoryTagFilter,
        memoryArchivedOnly,
        memorySortOrder,
        notesActiveTab: notesTab,
      },
    },
    workflows: {
      ...base.workflows,
      reminders: base.settings.notifications.reminders,
      notes: base.settings.helperPreferences.notesRememberDrafts
        ? notesWorkflow
        : defaultDataSnapshot.workflows.notes,
    },
  })

  const pushToast = (message: string, tone: ToastTone = 'info') => {
    const id = createId()
    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 2600)
  }

  const updateStatus = (message: string, tone?: ToastTone, toast = false) => {
    setStatusMessage(message)
    if (toast && tone) {
      pushToast(message, tone)
    }
  }

  const recordActivity = (
    current: AppData,
    type: ActivityType,
    title: string,
    detail: string,
    entityId?: string,
  ): AppData => ({
    ...current,
    workflows: {
      ...current.workflows,
      activityLog: [
        {
          id: createId(),
          type,
          title,
          detail,
          entityId,
          createdAt: nowIso(),
        },
        ...current.workflows.activityLog,
      ].slice(0, 60),
    },
  })

  const persistAppData = async (
    nextBase: AppData,
    successMessage: string,
    tone: ToastTone = 'success',
    toast = false,
    silent = false,
  ) => {
    const next = composeAppData(nextBase)
    setAppData(next)
    setIsSaving(true)

    try {
      const saved = await saveAppData(next)
      setAppData(saved)
      if (!silent && successMessage) {
        updateStatus(successMessage, tone, toast)
      }
    } catch {
      updateStatus('Unable to save locally right now.', 'warning', true)
    } finally {
      setIsSaving(false)
    }
  }

  const updateAppData = async (
    updater: (current: AppData) => AppData,
    successMessage: string,
    tone: ToastTone = 'success',
    toast = false,
    silent = false,
  ) => {
    const next = updater(appDataRef.current)
    await persistAppData(next, successMessage, tone, toast, silent)
  }

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current)
    }

    persistTimerRef.current = window.setTimeout(() => {
      void persistAppData(appDataRef.current, '', 'info', false, true)
    }, 260)

    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current)
      }
    }
  }, [
    hydrated,
    activeView,
    sidebarCollapsed,
    themePreference,
    memorySearch,
    memoryFilter,
    memoryPinnedOnly,
    memoryTagFilter,
    memoryArchivedOnly,
    memorySortOrder,
    notesTab,
    notesWorkflow,
  ])

  const createMemoryEntry = (
    title: string,
    content: string,
    category: MemoryCategory,
    source: string,
    tags: string[],
    pinned: boolean,
    favorite: boolean,
    importance: MemoryImportance,
    safeForLocalAi: boolean,
    archived: boolean,
  ): MemoryEntry => {
    const stamp = nowIso()
    return {
      id: createId(),
      category,
      title,
      content,
      source,
      tags,
      pinned,
      favorite,
      importance,
      safeForLocalAi,
      archived,
      syncMeta: createSyncMeta(),
      createdAt: stamp,
      updatedAt: stamp,
    }
  }

  const saveTextToMemory = async (
    title: string,
    content: string,
    category: MemoryCategory,
    source: string,
    tags: string[] = [],
  ) => {
    const entry = createMemoryEntry(
      title,
      content,
      category,
      source,
      tags,
      false,
      false,
      'normal',
      false,
      false,
    )

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            memory: [entry, ...current.memory],
          },
          'memory_saved',
          'Memory saved',
          title,
          entry.id,
        ),
      'Saved to local memory.',
      'success',
      true,
    )
  }

  const saveResponseToMemory = async (
    response: StructuredAiResponse,
    source: string,
    customCategory?: MemoryCategory,
  ) => {
    await saveTextToMemory(
      response.title,
      responseToMemoryText(response),
      customCategory ?? brain.suggestMemoryCategory(response),
      source,
      response.memoryUpdates?.slice(0, 4) ?? [],
    )
  }

  const handleCopy = async (text: string, successMessage = 'Copied to clipboard.') => {
    const copied = await copyText(text)
    updateStatus(
      copied ? successMessage : 'Copy failed on this device.',
      copied ? 'success' : 'warning',
      true,
    )
  }

  const generateResponse = async (
    input: string,
    routeOverride?: BrainIntent,
    variant?: string,
  ) => {
    // Health and helper flows stay rule-based until a future health-safe AI wrapper phase.
    const response = brain.generate({
      input,
      memory: appDataRef.current.memory,
      providerId: 'rule-based',
      routeOverride,
      variant,
    })
    return response
  }

  const generateChatAssistantResponse = async (
    input: string,
    conversation: Conversation | null,
  ) => {
    // Chat-only Ollama path: helpers (especially Health) remain rule-based for safety.
    const localAi = settingsDraft.localAi
    const ollamaGuard = canUseOllamaForChat(localAi, ollamaStatus)
    if (!ollamaGuard.allowed) {
      const failingStage =
        localAi.providerMode !== 'ollama'
          ? 'chat_guard_provider_mode'
          : !localAi.ollama.enabled
            ? 'chat_guard_ollama_disabled'
            : !localAi.ollama.selectedModel.trim()
              ? 'chat_guard_model_missing'
              : !isSelectedOllamaModelAvailable(
                    localAi.ollama.selectedModel,
                    localAi.ollama.availableModels,
                  )
                ? 'chat_guard_model_unavailable'
                : 'chat_guard_ollama_unavailable'
      const fallbackReason = `CHAT DEBUG: ollama failed. Ollama stage failed: ${failingStage}. Exact error: ${ollamaGuard.reason}. Using rule-based fallback instead.`
      return {
        response: brain.generate({
          input,
          memory: appDataRef.current.memory,
          providerId: 'rule-based',
        }),
        usedFallback: true,
        fallbackReason,
      }
    }

    let safePrompt = input
    try {
      const context = buildSafeLocalAiContext({
        appData: appDataRef.current,
        conversation,
        input,
      })
      safePrompt = context.prompt
    } catch {
      setChatRuntimeStatus('Context assembly failed, using minimal prompt')
      safePrompt = input
    }

    setChatRuntimeStatus('CHAT DEBUG: invoking ollama')
    const ollamaResult = await generateWithOllama(
      localAi.ollama.baseUrl,
      localAi.ollama.selectedModel,
      safePrompt,
    )

    if (!ollamaResult.ok || !ollamaResult.text.trim()) {
      console.warn(
        '[GodzillaModeAI] Renderer stage: ollama_request_failed',
        JSON.stringify({
          ok: ollamaResult.ok,
          message: ollamaResult.message,
          errorMessage: ollamaResult.errorMessage ?? '',
          textLength: ollamaResult.text.length,
        }),
      )
      const exactError =
        ollamaResult.errorMessage?.trim() || ollamaResult.message?.trim() || 'unknown error'
      const friendlyFailure = `CHAT DEBUG: ollama failed. Ollama stage failed: ollama_generate_request. Exact error: ${exactError}. Using rule-based fallback instead.`
      return {
        response: brain.generate({
          input,
          memory: appDataRef.current.memory,
          providerId: 'rule-based',
        }),
        usedFallback: true,
        fallbackReason: friendlyFailure,
      }
    }

    const cleanedBullets = ollamaResult.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6)
    const checkedAt = nowIso()
    setOllamaStatus((current) => ({
      ...current,
      available: true,
      message: 'Connected to local Ollama.',
      checkedAt,
    }))
    setSettingsDraft((current) => ({
      ...current,
      localAi: {
        ...current.localAi,
        ollama: {
          ...current.localAi.ollama,
          lastStatus: 'ready',
          lastCheckedAt: checkedAt,
          errorMessage: '',
        },
      },
    }))
    console.info(
      '[GodzillaModeAI] Renderer stage: ollama_success_response_forwarded',
      JSON.stringify({
        model: localAi.ollama.selectedModel,
        textLength: ollamaResult.text.length,
      }),
    )
    setChatRuntimeStatus('CHAT DEBUG: ollama success')

    return {
      response: {
        type: 'general',
        title: 'CHAT DEBUG: ollama success',
        responseText: ollamaResult.text.trim(),
        bullets: cleanedBullets.length > 0 ? cleanedBullets : ['Local Ollama response generated.'],
        suggestedActions: [
          'Ask a follow-up question to refine the response.',
          'Save useful points to memory.',
          'Switch back to rule-based mode anytime in settings.',
        ],
        safetyLevel: 'info' as const,
      },
      usedFallback: false,
      fallbackReason: '',
    }
  }

  const handleCtrlEnter = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
    action: () => void,
  ) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      action()
    }
  }

  const currentConversation =
    appData.workflows.chat.conversations.find(
      (conversation) => conversation.id === appData.workflows.chat.activeConversationId,
    ) ?? appData.workflows.chat.conversations[0]

  const switchConversation = async (conversationId: string) => {
    await updateAppData(
      (current) => ({
        ...current,
        workflows: {
          ...current.workflows,
          chat: {
            ...current.workflows.chat,
            activeConversationId: conversationId,
          },
        },
      }),
      'Conversation switched.',
      'info',
      false,
      true,
    )

    const conversation = appDataRef.current.workflows.chat.conversations.find(
      (item) => item.id === conversationId,
    )
    setEditingConversationTitle(conversation?.title ?? '')
  }

  const handleSendChat = async () => {
    if (isSendingChat) {
      return
    }

    const message = composer.trim()
    if (!message || !currentConversation) {
      updateStatus('Type a message before sending.', 'warning', true)
      return
    }

    setIsSendingChat(true)
    setChatRuntimeStatus('Thinking locally...')
    try {
      const chatResult = await generateChatAssistantResponse(message, currentConversation ?? null)
      const response = chatResult.response
      const stamp = nowIso()

      if (chatResult.usedFallback && chatResult.fallbackReason) {
        updateStatus(chatResult.fallbackReason, 'warning', true)
        setChatRuntimeStatus('CHAT DEBUG: ollama failed')
      } else {
        setChatRuntimeStatus(
          settingsDraft.localAi.providerMode === 'ollama'
            ? `CHAT DEBUG: ollama success (${settingsDraft.localAi.ollama.selectedModel})`
            : 'Rule-based active',
        )
      }

      await updateAppData(
        (current) =>
          recordActivity(
            {
              ...current,
              workflows: {
                ...current.workflows,
                chat: {
                  ...current.workflows.chat,
                  conversations: current.workflows.chat.conversations.map((conversation) =>
                    conversation.id === currentConversation.id
                      ? {
                          ...conversation,
                          updatedAt: stamp,
                          messages: [
                            ...conversation.messages,
                            {
                              id: createId(),
                              role: 'user',
                              content: message,
                              createdAt: stamp,
                            },
                            {
                              id: createId(),
                              role: 'assistant',
                              content: response.responseText,
                              createdAt: nowIso(),
                              response,
                            },
                          ],
                        }
                      : conversation,
                  ),
                },
              },
            },
            'conversation_saved',
            'Conversation updated',
            currentConversation.title,
            currentConversation.id,
          ),
        `${response.title} added to chat history.`,
      )

      setComposer('')
    } finally {
      setIsSendingChat(false)
    }
  }

  const createConversation = async () => {
    const stamp = nowIso()
    const conversation: Conversation = {
      id: createId(),
      title: `Conversation ${appData.workflows.chat.conversations.length + 1}`,
      createdAt: stamp,
      updatedAt: stamp,
      pinned: false,
      messages: [],
    }

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            workflows: {
              ...current.workflows,
              chat: {
                activeConversationId: conversation.id,
                conversations: [conversation, ...current.workflows.chat.conversations],
              },
            },
          },
          'conversation_saved',
          'Conversation created',
          conversation.title,
          conversation.id,
        ),
      'Conversation created.',
      'success',
      true,
    )

    setEditingConversationTitle(conversation.title)
  }

  const renameConversation = async () => {
    if (!currentConversation || !editingConversationTitle.trim()) {
      updateStatus('Add a conversation title first.', 'warning', true)
      return
    }

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            workflows: {
              ...current.workflows,
              chat: {
                ...current.workflows.chat,
                conversations: current.workflows.chat.conversations.map((conversation) =>
                  conversation.id === currentConversation.id
                    ? {
                        ...conversation,
                        title: editingConversationTitle.trim(),
                        updatedAt: nowIso(),
                      }
                    : conversation,
                ),
              },
            },
          },
          'conversation_saved',
          'Conversation renamed',
          editingConversationTitle.trim(),
          currentConversation.id,
        ),
      'Conversation renamed.',
      'success',
      true,
    )
  }

  const deleteConversation = async (conversationId: string) => {
    if (appData.workflows.chat.conversations.length <= 1) {
      updateStatus('Keep at least one conversation in the app.', 'warning', true)
      return
    }

    if (!window.confirm('Delete this saved conversation?')) {
      return
    }

    await updateAppData(
      (current) => {
        const remaining = current.workflows.chat.conversations.filter(
          (conversation) => conversation.id !== conversationId,
        )
        const nextActiveId =
          current.workflows.chat.activeConversationId === conversationId
            ? remaining[0]?.id ?? null
            : current.workflows.chat.activeConversationId

        return recordActivity(
          {
            ...current,
            workflows: {
              ...current.workflows,
              chat: {
                conversations: remaining,
                activeConversationId: nextActiveId,
              },
            },
          },
          'conversation_deleted',
          'Conversation deleted',
          conversationId,
          conversationId,
        )
      },
      'Conversation deleted.',
      'success',
      true,
    )
  }

  const exportConversation = async (conversation: Conversation) => {
    const blob = new Blob([buildConversationExportText(conversation)], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${conversation.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'conversation'}.txt`
    link.click()
    URL.revokeObjectURL(url)
    updateStatus('Conversation exported.', 'success', true)

    await updateAppData(
      (current) =>
        recordActivity(
          current,
          'export_completed',
          'Conversation exported',
          conversation.title,
          conversation.id,
        ),
      '',
      'info',
      false,
      true,
    )
  }

  const runHealthAnalysis = async () => {
    if (!healthInput.trim()) {
      updateStatus('Paste health notes before running the helper.', 'warning', true)
      return
    }

    const [summary, bloodSugar, medicine, symptom, doctor] = await Promise.all([
      generateResponse(healthInput, 'health_summary'),
      generateResponse(healthInput, 'blood_sugar'),
      generateResponse(healthInput, 'medicine_log'),
      generateResponse(healthInput, 'symptom_note'),
      generateResponse(healthInput, 'doctor_report'),
    ])
    setHealthBundle({ summary, bloodSugar, medicine, symptom, doctor })

    updateStatus('Health summary generated.', 'success', true)
  }

  const matchChecklistState = (current: ChecklistItem[], nextLabels: string[]) => {
    const lookup = new Map(
      current.map((item) => [item.label.trim().toLowerCase(), item]),
    )

    return nextLabels.map((label) => {
      const previous = lookup.get(label.trim().toLowerCase())
      return {
        id: previous?.id ?? createId(),
        label,
        completed: previous?.completed ?? false,
      }
    })
  }

  const matchTaskState = (current: TaskItem[], nextLabels: string[]) => {
    const lookup = new Map(
      current.map((item) => [item.label.trim().toLowerCase(), item]),
    )

    return nextLabels.map((label) => {
      const previous = lookup.get(label.trim().toLowerCase())
      const stamp = nowIso()
      return {
        id: previous?.id ?? createId(),
        label,
        completed: previous?.completed ?? false,
        dueDate: previous?.dueDate ?? null,
        priority: previous?.priority ?? 'normal',
        category: previous?.category ?? 'general',
        pinned: previous?.pinned ?? false,
        syncMeta: previous?.syncMeta ?? createSyncMeta(),
        createdAt: previous?.createdAt ?? stamp,
        updatedAt: stamp,
      }
    })
  }

  const runNotesAnalysis = async () => {
    const input = notesWorkflow.input.trim()
    if (!input) {
      updateStatus('Paste notes before running the helper.', 'warning', true)
      return
    }

    const [cleanResponse, shoppingResponse, tasksResponse] = await Promise.all([
      generateResponse(input, 'messy_notes'),
      generateResponse(input, 'shopping_text'),
      generateResponse(input, 'todo_text'),
    ])

    setNotesWorkflow((current) => ({
      ...current,
      input,
      cleanText: cleanResponse.bullets.join('\n'),
      shoppingItems: matchChecklistState(current.shoppingItems, shoppingResponse.bullets),
      taskItems: matchTaskState(current.taskItems, tasksResponse.bullets),
      updatedAt: nowIso(),
    }))

    void updateAppData(
      (current) =>
        recordActivity(
          current,
          'notes_updated',
          'Notes workflow updated',
          'Generated fresh clean notes, shopping items, and tasks.',
        ),
      'Notes workflow updated.',
      'success',
      true,
    )
  }

  const runFocusedHelper = async (
    input: string,
    route: BrainIntent,
    setter: (value: StructuredAiResponse) => void,
    successMessage: string,
    variant?: string,
  ) => {
    if (!input.trim()) {
      updateStatus('Paste or type a little text first.', 'warning', true)
      return
    }

    const response = await generateResponse(input, route, variant)
    setter(response)
    updateStatus(successMessage, 'success', true)
  }

  const handleSaveManualMemory = async () => {
    if (!manualMemoryTitle.trim() || !manualMemoryContent.trim()) {
      updateStatus('Add a memory title and content first.', 'warning', true)
      return
    }

    const entry = createMemoryEntry(
      manualMemoryTitle.trim(),
      manualMemoryContent.trim(),
      manualMemoryCategory,
      manualMemorySource.trim() || 'manual_entry',
      parseTags(manualMemoryTags),
      manualMemoryPinned,
      manualMemoryFavorite,
      manualMemoryImportance,
      manualMemorySafeForLocalAi,
      manualMemoryArchived,
    )

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            memory: [entry, ...current.memory],
          },
          'memory_saved',
          'Manual memory saved',
          entry.title,
          entry.id,
        ),
      'Memory entry saved locally.',
      'success',
      true,
    )

    setManualMemoryTitle('')
    setManualMemoryContent('')
    setManualMemorySource('manual_entry')
    setManualMemoryTags('')
    setManualMemoryPinned(false)
    setManualMemoryFavorite(false)
    setManualMemoryImportance('normal')
    setManualMemorySafeForLocalAi(false)
    setManualMemoryArchived(false)
  }

  const setWorkflowRuntime = async (
    routineId: string | null,
    status: AppData['workflows']['routineRuntime']['status'],
    message: string,
  ) => {
    await updateAppData(
      (current) => ({
        ...current,
        workflows: {
          ...current.workflows,
          routineRuntime: {
            activeRoutineId: routineId,
            status,
            message,
            updatedAt: nowIso(),
          },
        },
      }),
      '',
      'info',
      false,
      true,
    )
  }

  const toggleWorkflowEnabled = async (routineId: string) => {
    await updateAppData(
      (current) => ({
        ...current,
        workflows: {
          ...current.workflows,
          routines: current.workflows.routines.map((routine) =>
            routine.id === routineId
              ? { ...routine, enabled: !routine.enabled }
              : routine,
          ),
        },
      }),
      'Workflow updated.',
      'success',
      true,
    )
  }

  const runWorkflowNow = async (routine: WorkflowRoutine) => {
    if (runningWorkflowId) {
      updateStatus('A workflow is already running.', 'info', true)
      return
    }
    if (!routine.enabled) {
      updateStatus('Enable this workflow before running.', 'warning', true)
      return
    }

    setRunningWorkflowId(routine.id)
    await setWorkflowRuntime(routine.id, 'running', `${routine.name} started`)
    await updateAppData(
      (current) => ({
        ...current,
        workflows: {
          ...current.workflows,
              routines: current.workflows.routines.map((item) =>
                item.id === routine.id
                  ? {
                      ...item,
                      status: 'running',
                      syncMeta: {
                        ...item.syncMeta,
                        lastModified: nowIso(),
                        pendingSync: item.syncMeta.syncEligible,
                      },
                    }
                  : item,
              ),
        },
      }),
      'Workflow started.',
      'success',
      true,
    )

    const result = await runWorkflowRoutine(routine)
    const nextStatus = result.ok ? 'completed' : 'failed'
    await setWorkflowRuntime(routine.id, nextStatus, result.message)
    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            workflows: {
              ...current.workflows,
              routines: current.workflows.routines.map((item) =>
                item.id === routine.id
                  ? {
                      ...item,
                      status: nextStatus,
                      lastRunAt: nowIso(),
                      syncMeta: {
                        ...item.syncMeta,
                        lastModified: nowIso(),
                        pendingSync: item.syncMeta.syncEligible,
                      },
                    }
                  : item,
              ),
            },
          },
          result.ok ? 'notes_updated' : 'workflow_failed',
          result.ok ? 'Workflow completed' : 'Workflow failed safely',
          routine.name,
          routine.id,
        ),
      result.ok ? 'Workflow completed.' : 'Workflow failed safely.',
      result.ok ? 'success' : 'warning',
      true,
    )
    setRunningWorkflowId(null)
  }

  const updateMemoryEntry = async (
    id: string,
    updater: (entry: MemoryEntry) => MemoryEntry,
    successMessage: string,
    toast = true,
  ) => {
    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            memory: current.memory.map((entry) =>
              entry.id === id ? updater(entry) : entry,
            ),
          },
          'memory_updated',
          'Memory updated',
          id,
          id,
        ),
      successMessage,
      'success',
      toast,
    )
  }

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm('Delete this memory entry?')) {
      return
    }

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            memory: current.memory.filter((entry) => entry.id !== id),
          },
          'memory_deleted',
          'Memory deleted',
          id,
          id,
        ),
      'Memory entry deleted.',
      'success',
      true,
    )
  }

  const handleClearMemory = async () => {
    if (!window.confirm('Clear all saved memory entries? This cannot be undone.')) {
      return
    }

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            memory: [],
          },
          'memory_deleted',
          'All memory cleared',
          'Local memory store cleared.',
        ),
      'All memory cleared.',
      'success',
      true,
    )
  }

  const handleClearConversation = async () => {
    if (!currentConversation || !window.confirm('Clear the current conversation messages?')) {
      return
    }

    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            workflows: {
              ...current.workflows,
              chat: {
                ...current.workflows.chat,
                conversations: current.workflows.chat.conversations.map((conversation) =>
                  conversation.id === currentConversation.id
                    ? { ...conversation, messages: [], updatedAt: nowIso() }
                    : conversation,
                ),
              },
            },
          },
          'conversation_saved',
          'Conversation cleared',
          currentConversation.title,
          currentConversation.id,
        ),
      'Conversation cleared.',
      'success',
      true,
    )
  }

  const handleSaveSettings = async () => {
    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            settings: {
              ...current.settings,
              localFirst: settingsDraft.localFirst,
              providerSettings: {
                ...current.settings.providerSettings,
                preferredProvider:
                  settingsDraft.localAi.providerMode === 'ollama' ? 'ollama' : 'rule-based',
                ollamaUrl: settingsDraft.localAi.ollama.baseUrl,
                ollamaModel: settingsDraft.localAi.ollama.selectedModel,
              },
              androidBridge: settingsDraft.androidBridge,
              remoteAccess: settingsDraft.remoteAccess,
              sync: settingsDraft.sync,
              notifications: settingsDraft.notifications,
              release: {
                ...settingsDraft.release,
                environmentStatus: window.godzillaAPI
                  ? appInfo.isPackaged
                    ? 'packaged_desktop'
                    : 'desktop_shell'
                  : 'browser_fallback',
                buildChannel: appInfo.buildChannel,
              },
              security: settingsDraft.security,
              tester: settingsDraft.tester,
              accessibility: settingsDraft.accessibility,
              androidEcosystem: settingsDraft.androidEcosystem,
              localAi: settingsDraft.localAi,
              helperPreferences: {
                ...current.settings.helperPreferences,
                notesRememberDrafts: settingsDraft.notesRememberDrafts,
                focusPreset,
                focusTimerMinutes,
                familyTemplate,
                seniorEasyMode,
              },
            },
            workflows: {
              ...current.workflows,
              reminders: settingsDraft.notifications.reminders,
            },
          },
          'settings_saved',
          'Settings saved',
          'Persistent local settings updated.',
        ),
      'Settings saved locally.',
      'success',
      true,
    )
  }

  const handleOpenDataFolder = async () => {
    const opened = await openDataFolder()
    updateStatus(
      opened
        ? 'Opened local data folder.'
        : 'Data folder open is only available in the desktop shell.',
      opened ? 'success' : 'info',
      true,
    )
  }

  const requestBrowserNotificationPermission = async () => {
    if (!('Notification' in window)) {
      updateStatus('Notifications are unavailable in this browser runtime.', 'info', true)
      return
    }
    const result = await Notification.requestPermission()
    updateStatus(`Notification permission: ${result}.`, 'info', true)
  }

  const addReminder = () => {
    setSettingsDraft((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        reminders: [...current.notifications.reminders, createReminderItem()],
      },
    }))
  }

  const updateReminder = (id: string, patch: Partial<ReminderItem>) => {
    setSettingsDraft((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        reminders: current.notifications.reminders.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      },
    }))
  }

  const removeReminder = (id: string) => {
    setSettingsDraft((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        reminders: current.notifications.reminders.filter((item) => item.id !== id),
      },
    }))
  }

  const runImportExportValidationCheck = () => {
    try {
      const snapshot = composeAppData(appDataRef.current)
      const serialized = JSON.stringify(snapshot)
      JSON.parse(serialized)
      updateStatus('Import/export validation check passed (local-only).', 'success', true)
    } catch {
      updateStatus('Import/export validation check failed.', 'warning', true)
    }
  }

  const runWorkflowResetPreview = () => {
    updateStatus(
      'Workflow reset helper is in preview mode. No data was modified automatically.',
      'info',
      true,
    )
  }

  const runSafeCacheClearPreview = () => {
    updateStatus(
      'Safe cache clear helper is in preview mode. No local data was removed.',
      'info',
      true,
    )
  }

  const refreshSyncPreviewStatus = async () => {
    const stamp = nowIso()
    const pairedDevice = settingsDraft.androidBridge.pairedDevices[0]
    const pendingChanges =
      syncPreviewStats.notes +
      syncPreviewStats.tasks +
      syncPreviewStats.workflowRoutines +
      syncPreviewStats.memoryHighlights
    setSettingsDraft((current) => ({
      ...current,
      androidBridge: {
        ...current.androidBridge,
        syncPreviewLastCheckedAt: stamp,
      },
      sync: {
        ...current.sync,
        lastSyncSessionId: pairedDevice ? `sync-${pairedDevice.id}` : null,
      },
    }))
    await updateAppData(
      (current) =>
        recordActivity(
          {
            ...current,
            workflows: {
              ...current.workflows,
              syncSessions: pairedDevice
                ? [
                    {
                      syncSessionId: `sync-${pairedDevice.id}`,
                      pairedDeviceId: pairedDevice.id,
                      syncState:
                        current.settings.androidBridge.enabled &&
                        current.settings.androidBridge.bridgeMode !== 'off'
                          ? 'ready'
                          : 'inactive',
                      lastSyncAt: null,
                      pendingChanges,
                      syncDirection: 'bidirectional',
                      syncConflictState: 'none',
                      transport:
                        current.settings.androidBridge.bridgeMode === 'tailscale_ready'
                          ? 'tailscale'
                          : 'localhost_bridge',
                      transportAvailable:
                        current.settings.androidBridge.enabled &&
                        current.settings.androidBridge.bridgeMode !== 'off',
                      localOnly: true,
                    },
                  ]
                : [],
              syncConflicts: pendingChanges > 0
                ? [
                    {
                      id: 'conflict-placeholder-1',
                      entityType: 'note',
                      entityId: 'notes-clean-text',
                      localVersion: 1,
                      remoteVersion: 1,
                      lastWriteAtLocal: stamp,
                      lastWriteAtRemote: stamp,
                      summary:
                        'Conflict tracking placeholder only. Auto-merge is intentionally disabled.',
                      requiresManualResolution: true,
                    },
                  ]
                : [],
            },
          },
          'sync_prep_event',
          'Sync preview refreshed',
          'Android bridge sync preview metadata updated locally.',
        ),
      'Sync preview refreshed.',
      'success',
      true,
    )
  }

  const toggleExpandedMemory = (id: string) => {
    setExpandedMemoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const updateChecklistItem = (
    listKey: 'shoppingItems',
    id: string,
    updater: (item: ChecklistItem) => ChecklistItem,
  ) => {
    setNotesWorkflow((current) => ({
      ...current,
      [listKey]: current[listKey].map((item) => (item.id === id ? updater(item) : item)),
      updatedAt: nowIso(),
    }))
  }

  const updateTaskItem = (id: string, updater: (item: TaskItem) => TaskItem) => {
    setNotesWorkflow((current) => ({
      ...current,
      taskItems: current.taskItems.map((item) => (item.id === id ? updater(item) : item)),
      updatedAt: nowIso(),
    }))
  }

  const addChecklistItem = () => {
    setNotesWorkflow((current) => ({
      ...current,
      shoppingItems: [...current.shoppingItems, createChecklistItem('')],
      updatedAt: nowIso(),
    }))
  }

  const addTaskItem = () => {
    setNotesWorkflow((current) => ({
      ...current,
      taskItems: [...current.taskItems, createTaskItem('')],
      updatedAt: nowIso(),
    }))
  }

  const clearNotesSection = (section: NotesWorkflowTab) => {
    setNotesWorkflow((current) => {
      if (section === 'clean') {
        return { ...current, cleanText: '', updatedAt: nowIso() }
      }

      if (section === 'shopping') {
        return { ...current, shoppingItems: [], updatedAt: nowIso() }
      }

      return { ...current, taskItems: [], updatedAt: nowIso() }
    })

    updateStatus('Notes section reset.', 'success', true)
  }

  const bulkCompleteVisibleTasks = () => {
    const visibleIds = new Set(filteredTaskItems.filter((task) => !task.completed).map((task) => task.id))
    if (visibleIds.size === 0) {
      updateStatus('No visible active tasks to complete.', 'info', true)
      return
    }

    setNotesWorkflow((current) => ({
      ...current,
      taskItems: current.taskItems.map((task) =>
        visibleIds.has(task.id)
          ? { ...task, completed: true, updatedAt: nowIso() }
          : task,
      ),
      updatedAt: nowIso(),
    }))

    void updateAppData(
      (current) =>
        recordActivity(
          current,
          'task_completed',
          'Bulk task completion',
          `${visibleIds.size} visible tasks completed.`,
        ),
      'Visible tasks marked complete.',
      'success',
      true,
    )
  }

  const bulkDeleteCompletedTasks = () => {
    const completedCount = notesWorkflow.taskItems.filter((task) => task.completed).length
    if (completedCount === 0) {
      updateStatus('No completed tasks to delete.', 'info', true)
      return
    }

    if (!window.confirm(`Delete ${completedCount} completed tasks?`)) {
      return
    }

    setNotesWorkflow((current) => ({
      ...current,
      taskItems: current.taskItems.filter((task) => !task.completed),
      updatedAt: nowIso(),
    }))

    void updateAppData(
      (current) =>
        recordActivity(
          current,
          'task_saved',
          'Completed tasks deleted',
          `${completedCount} completed tasks removed from the workflow.`,
        ),
      'Completed tasks deleted.',
      'success',
      true,
    )
  }

  const exportFullBackup = async () => {
    // Future-safe placeholder: support selective export/import with optional local encryption.
    const data = composeAppData(appDataRef.current)
    const payload = {
      backupMetadata: {
        createdAt: nowIso(),
        exportVersion: 'phase-21-local-backup-v1',
        deviceName: 'local-device-placeholder',
        appVersion: appInfo.appVersion,
        localOnlyExport: true as const,
      },
      data,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kcxmodeai-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    updateStatus('Full local backup exported.', 'success', true)

    await updateAppData(
      (current) =>
        recordActivity(
          current,
          'export_completed',
          'Full backup exported',
          'JSON backup downloaded locally.',
        ),
      '',
      'info',
      false,
      true,
    )
  }

  const exportLocalBundle = async (
    kind: 'workflows' | 'safe_memory' | 'settings' | 'notes_tasks',
  ) => {
    const data = appDataRef.current
    const payload =
      kind === 'workflows'
        ? { backupMetadata: { createdAt: nowIso(), exportVersion: 'workflow-v1', deviceName: 'local-device-placeholder', appVersion: appInfo.appVersion, localOnlyExport: true as const }, workflows: { routines: data.workflows.routines, notes: data.workflows.notes, reminders: data.workflows.reminders, syncSessions: data.workflows.syncSessions, syncConflicts: data.workflows.syncConflicts } }
        : kind === 'safe_memory'
          ? { backupMetadata: { createdAt: nowIso(), exportVersion: 'safe-memory-v1', deviceName: 'local-device-placeholder', appVersion: appInfo.appVersion, localOnlyExport: true as const }, memory: data.memory.filter((entry) => entry.safeForLocalAi && !entry.archived) }
          : kind === 'settings'
            ? { backupMetadata: { createdAt: nowIso(), exportVersion: 'settings-v1', deviceName: 'local-device-placeholder', appVersion: appInfo.appVersion, localOnlyExport: true as const }, settings: data.settings }
            : {
                backupMetadata: { createdAt: nowIso(), exportVersion: 'notes-tasks-v1', deviceName: 'local-device-placeholder', appVersion: appInfo.appVersion, localOnlyExport: true as const },
                notes: {
                  cleanText: data.workflows.notes.cleanText,
                  taskItems: data.workflows.notes.taskItems,
                  shoppingItems: data.workflows.notes.shoppingItems,
                },
              }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kcxmodeai-${kind}-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    updateStatus(`Local ${kind.replace('_', ' ')} export generated.`, 'success', true)
  }

  const exportTesterBundle = async () => {
    const securitySummary = {
      localOnlyMode: appData.settings.localFirst,
      aiSafeMemoryCount: appData.memory.filter((entry) => entry.safeForLocalAi).length,
      syncEligibleCount: appData.memory.filter((entry) => entry.syncMeta.syncEligible).length,
      exportSafeItemCount: appData.memory.filter((entry) => entry.safeForLocalAi && !entry.archived)
        .length,
      helperIsolationStatus:
        'Health helper stays rule-based only. Family/Senior/Focus helpers remain isolated.',
    }
    const payload = {
      backupMetadata: {
        createdAt: nowIso(),
        exportVersion: 'tester-diagnostics-v1',
        deviceName: 'local-device-placeholder',
        appVersion: appInfo.appVersion,
        localOnlyExport: true as const,
      },
      diagnosticsSummary,
      workflowSummary: {
        workflowCount: appData.workflows.routines.length,
        activeRoutineId: appData.workflows.routineRuntime.activeRoutineId,
        taskCount: notesWorkflow.taskItems.length,
      },
      aiSafeMemorySummary: appData.memory
        .filter((entry) => entry.safeForLocalAi)
        .slice(0, 200)
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          category: entry.category,
          updatedAt: entry.updatedAt,
        })),
      runtimeSummary: {
        runtime: window.godzillaAPI ? 'desktop shell' : 'browser fallback',
        buildChannel: appInfo.buildChannel,
        environmentStatus: appInfo.environmentStatus,
      },
      securitySummary,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kcxmodeai-tester-diagnostics-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    updateStatus('Tester diagnostics bundle exported locally.', 'success', true)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      if (!isImportPayloadShapeSafe(parsed)) {
        throw new Error('Invalid import shape')
      }
      const candidate = (() => {
        const record = parsed as Record<string, unknown>
        if (record.data && typeof record.data === 'object') {
          return record.data as AppData
        }
        return parsed as AppData
      })()
      if (
        !window.confirm(
          `Import "${file.name}" and replace current local data snapshot? This cannot be undone without an existing backup.`,
        )
      ) {
        updateStatus('Import cancelled. Current local data was unchanged.', 'info', true)
        return
      }
      const saved = await saveAppData(candidate)
      applyLoadedData(saved)
      updateStatus('Import completed successfully.', 'success', true)

      await updateAppData(
        (current) =>
          recordActivity(
            current,
            'import_completed',
            'Data imported',
            file.name,
          ),
        '',
        'info',
        false,
        true,
      )
    } catch {
      updateStatus('Import failed. Check that the file is valid JSON.', 'warning', true)
      void updateAppData(
        (current) =>
          recordActivity(
            current,
            'recovery_event',
            'Import recovery event',
            'Import failed and existing local data was preserved.',
          ),
        '',
        'info',
        false,
        true,
      )
    }
  }

  const recentMemoryCount = appData.memory.filter((entry) => {
    const age = Date.now() - new Date(entry.updatedAt).getTime()
    return age <= 1000 * 60 * 60 * 24 * 7
  }).length

  const activeConversation = currentConversation
  const recentConversations = [...appData.workflows.chat.conversations].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )

  const filteredMemory = useMemo(() => {
    const working = [...appData.memory].filter((entry) => {
      const matchesCategory = memoryFilter === 'all' || entry.category === memoryFilter
      const matchesPinned = memoryPinnedOnly ? entry.pinned : true
      const matchesArchived = memoryArchivedOnly ? entry.archived : !entry.archived
      const matchesTag = memoryTagFilter
        ? entry.tags.some((tag) => tag.toLowerCase().includes(memoryTagFilter.toLowerCase()))
        : true
      const searchText =
        `${entry.title} ${entry.content} ${entry.source} ${entry.tags.join(' ')}`.toLowerCase()
      const matchesSearch = searchText.includes(memorySearch.toLowerCase())
      const matchesAiSafeVisibility = settingsDraft.security.partitioning.localAiSafeOnlyVisibility
        ? entry.safeForLocalAi
        : true
      const matchesExportVisibility = settingsDraft.security.partitioning.exportSafeOnlyVisibility
        ? entry.safeForLocalAi && !entry.archived
        : true
      const matchesSyncVisibility = settingsDraft.security.partitioning.syncEligibleOnlyVisibility
        ? entry.syncMeta.syncEligible
        : true
      return (
        matchesCategory &&
        matchesPinned &&
        matchesArchived &&
        matchesTag &&
        matchesSearch &&
        matchesAiSafeVisibility &&
        matchesExportVisibility &&
        matchesSyncVisibility
      )
    })

    working.sort((left, right) =>
      memorySortOrder === 'newest'
        ? new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        : new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime(),
    )

    working.sort((left, right) => Number(right.pinned) - Number(left.pinned))
    working.sort((left, right) => Number(right.favorite) - Number(left.favorite))

    return working
  }, [
    appData.memory,
    memoryFilter,
    memoryPinnedOnly,
    memoryArchivedOnly,
    memoryTagFilter,
    memorySearch,
    memorySortOrder,
    settingsDraft.security.partitioning.localAiSafeOnlyVisibility,
    settingsDraft.security.partitioning.exportSafeOnlyVisibility,
    settingsDraft.security.partitioning.syncEligibleOnlyVisibility,
  ])

  const taskCategories = useMemo(() => {
    const values = Array.from(
      new Set(
        notesWorkflow.taskItems
          .map((task) => task.category.trim())
          .filter(Boolean),
      ),
    ).sort()

    return values
  }, [notesWorkflow.taskItems])

  const filteredTaskItems = useMemo(() => {
    return notesWorkflow.taskItems.filter((task) => {
      const matchesSearch = task.label
        .toLowerCase()
        .includes(notesWorkflow.taskSearch.toLowerCase())
      const matchesCategory =
        notesWorkflow.taskFilterCategory === 'all' ||
        task.category === notesWorkflow.taskFilterCategory
      const overdue = isOverdueTask(task)
      const matchesStatus =
        notesWorkflow.taskFilterStatus === 'all'
          ? true
          : notesWorkflow.taskFilterStatus === 'active'
            ? !task.completed
            : notesWorkflow.taskFilterStatus === 'completed'
              ? task.completed
              : overdue

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [notesWorkflow])

  const activeTasks = filteredTaskItems.filter((task) => !task.completed)
  const completedTasks = filteredTaskItems.filter((task) => task.completed)
  const memoryCategoryBreakdown = useMemo(() => {
    const counts = new Map<MemoryCategory, number>()
    for (const entry of appData.memory) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [appData.memory])

  const selectedProvider = providerCatalog.find((provider) =>
    settingsDraft.localAi.providerMode === 'ollama'
      ? provider.id === 'ollama'
      : provider.id === 'rule-based',
  )

  const networkReadinessLabel =
    networkStatus.readinessStatus === 'hybrid_ready'
      ? 'Hybrid-ready over Tailscale'
      : networkStatus.readinessStatus === 'remote_ready_partial'
        ? 'Partially ready (Tailscale incomplete)'
        : 'Local-only mode'
  const browserHostModeLabel =
    settingsDraft.remoteAccess.browserHostMode === 'lan'
      ? 'LAN'
      : settingsDraft.remoteAccess.browserHostMode === 'tailscale'
        ? 'Tailscale private mesh'
        : 'Localhost only'
  const remoteBrowserHost =
    settingsDraft.remoteAccess.browserHostMode === 'lan'
      ? networkStatus.localNetworkIp
      : settingsDraft.remoteAccess.browserHostMode === 'tailscale'
        ? networkStatus.tailscaleIp
        : '127.0.0.1'
  const remoteBrowserUrl = remoteBrowserHost
    ? `http://${remoteBrowserHost}:${settingsDraft.remoteAccess.browserPort}`
    : null
  const lanAccessible =
    settingsDraft.remoteAccess.browserAccessEnabled &&
    settingsDraft.remoteAccess.browserHostMode !== 'localhost_only' &&
    Boolean(networkStatus.localNetworkIp)
  const tailscaleAccessible =
    settingsDraft.remoteAccess.browserAccessEnabled &&
    settingsDraft.remoteAccess.browserHostMode === 'tailscale' &&
    Boolean(networkStatus.tailscaleIp) &&
    networkStatus.tailscaleRunning
  const privateBrowserAccessStatusLabel =
    privateBrowserAccessStatus.status === 'running'
      ? 'running'
      : privateBrowserAccessStatus.status === 'starting'
        ? 'starting'
        : privateBrowserAccessStatus.status === 'failed'
          ? 'failed'
          : 'stopped'

  const ollamaSelected = settingsDraft.localAi.providerMode === 'ollama'
  const activeProviderLabel =
    settingsDraft.localAi.providerMode === 'ollama' ? 'Ollama local AI' : 'Rule-Based Provider'
  const fallbackStatusLabel =
    settingsDraft.localAi.providerMode === 'ollama'
      ? settingsDraft.localAi.ollama.enabled && ollamaStatus.available
        ? `Ollama ready: ${settingsDraft.localAi.ollama.selectedModel || 'model selected'}.`
        : 'Ollama failed, using rule-based fallback.'
      : 'Rule-based mode is active.'
  const bridgeStatusLabel = appInfo.dataFilePath === 'remote-pc-host-storage'
    ? 'Active (remote client connected to PC host)'
    : settingsDraft.androidBridge.enabled
      ? settingsDraft.androidBridge.bridgeMode === 'tailscale_ready'
        ? 'Prepared (Tailscale-ready local preview)'
        : 'Prepared (local-only preview)'
      : 'Not active yet'
  const chatOllamaGuard = canUseOllamaForChat(settingsDraft.localAi, ollamaStatus)
  const bridgeModeOptions: AndroidBridgeSettings['bridgeMode'][] = [
    'off',
    'local_only',
    'tailscale_ready',
  ]
  const syncPreviewStats = {
    notes: notesWorkflow.cleanText.trim() ? 1 : 0,
    tasks: notesWorkflow.taskItems.length,
    workflowRoutines: appData.workflows.routines.length,
    memoryHighlights: appData.memory.filter((entry) => entry.safeForLocalAi && !entry.archived).length,
    focusRoutines: appData.workflows.routines.filter((item) => item.category === 'focus_session').length,
    familySeniorSummaries:
      (familyResult ? 1 : 0) + (seniorResult ? 1 : 0),
  }
  const activeReminders = settingsDraft.notifications.reminders.filter((item) => item.enabled)
  const nextReminder = [...activeReminders]
    .filter((item) => item.nextReminderAt)
    .sort(
      (left, right) =>
        new Date(left.nextReminderAt ?? 0).getTime() -
        new Date(right.nextReminderAt ?? 0).getTime(),
    )[0]
  const estimatedStorageSize = `${Math.round(
    JSON.stringify(appData).length / 1024,
  ).toLocaleString()} KB`
  const aiSafeMemoryCount = appData.memory.filter((entry) => entry.safeForLocalAi).length
  const syncEligibleCount = appData.memory.filter((entry) => entry.syncMeta.syncEligible).length
  const exportSafeCount = appData.memory.filter((entry) => entry.safeForLocalAi && !entry.archived)
    .length
  const isRemotePcHostStorage = appInfo.dataFilePath === 'remote-pc-host-storage'
  const isElectronStorage = Boolean(window.godzillaAPI)
  const storageModeLabel = isElectronStorage
    ? 'Electron local file storage'
    : isRemotePcHostStorage
      ? 'Remote PC host storage'
      : 'Browser localStorage fallback'
  const bridgeClientMode = isRemotePcHostStorage ? 'connected' : 'disconnected'
  const lastRecoveryEvent =
    appData.workflows.activityLog.find((entry) => entry.type === 'recovery_event') ?? null
  const diagnosticsSummary = {
    runtime: isElectronStorage ? 'Electron desktop shell' : 'Browser fallback',
    storageMode: storageModeLabel,
    ollamaStatus: ollamaStatus.available ? 'ready' : 'not active',
    workflowCount: appData.workflows.routines.length,
    memoryCount: appData.memory.length,
    storageEstimate: estimatedStorageSize,
    localAiState:
      appData.settings.localAi.providerMode === 'ollama' && ollamaStatus.available
        ? 'ollama_ready'
        : 'rule_based',
    localOnlyMode: appData.settings.localFirst ? 'enabled' : 'disabled',
    aiSafeMemoryCount,
    syncEligibleCount,
    exportSafeCount,
    helperIsolation:
      'Health isolated from Ollama; Family/Senior/Focus isolated; Android bridge isolated by default.',
    lastRecoveryEvent: lastRecoveryEvent?.detail ?? 'none',
  }
  const contextPreview = (() => {
    const activeConversation =
      appData.workflows.chat.conversations.find(
        (conversation) => conversation.id === appData.workflows.chat.activeConversationId,
      ) ?? appData.workflows.chat.conversations[0] ?? null
    try {
      return buildSafeLocalAiContext({
        appData,
        conversation: activeConversation ?? null,
        input: 'preview',
      }).summary
    } catch {
      return {
        contextMode: appData.settings.localAi.context.contextMode,
        estimatedMessagesIncluded: 0,
        tasksIncluded: false,
        notesIncluded: false,
        memoryHighlightsIncluded: false,
        healthDataIncluded: 'never' as const,
      }
    }
  })()
  const chatProviderHint = isSendingChat
    ? 'Ollama is generating...'
    : chatOllamaGuard.allowed
      ? `Ollama ready: ${settingsDraft.localAi.ollama.selectedModel}`
      : chatOllamaGuard.reason
  const selectedRoutine =
    appData.workflows.routines.find((routine) => routine.id === selectedWorkflowId) ??
    appData.workflows.routines[0] ??
    null
  const routineStatusText =
    appData.workflows.routineRuntime.updatedAt && appData.workflows.routineRuntime.message
      ? `${appData.workflows.routineRuntime.message} (${formatDate(appData.workflows.routineRuntime.updatedAt)})`
      : 'No workflow run yet'

  const currentView = viewDetails[activeView]
  const healthSummary = healthBundle.summary
  const noMemoryYet = appData.memory.length === 0
  const noFilteredMemory = filteredMemory.length === 0 && !noMemoryYet

  const healthSectionCards = [
    {
      title: 'Readings',
      content: extractLabeledBullet(
        healthSummary,
        'Readings',
        'Run the helper to extract readings.',
      ),
    },
    {
      title: 'Possible Pattern',
      content: extractLabeledBullet(
        healthSummary,
        'Possible pattern',
        'Run the helper to look for simple note-level patterns.',
      ),
    },
    {
      title: 'Medicine Notes',
      content: extractLabeledBullet(
        healthSummary,
        'Medicine notes',
        'Run the helper to collect medicine-related lines.',
      ),
    },
    {
      title: 'Symptom Notes',
      content: extractLabeledBullet(
        healthSummary,
        'Symptom notes',
        'Run the helper to collect symptom-related lines.',
      ),
    },
    {
      title: 'Doctor-Ready Note',
      content: extractLabeledBullet(
        healthSummary,
        'Doctor-ready note',
        'Run the helper to draft a cleaner clinician note.',
      ),
    },
    {
      title: 'Safety Note',
      content: extractLabeledBullet(
        healthSummary,
        'Safety note',
        'Run the helper to check for blood sugar safety flags.',
      ),
    },
  ]

  const dashboardWidgets: Record<
    DashboardWidgetId,
    { title: string; value: string; detail: string }
  > = {
    memory: {
      title: 'Memory',
      value: String(appData.memory.length),
      detail: `${recentMemoryCount} updated this week`,
    },
    tasks: {
      title: 'Tasks',
      value: String(notesWorkflow.taskItems.filter((task) => !task.completed).length),
      detail: `${notesWorkflow.taskItems.filter(isOverdueTask).length} overdue`,
    },
    conversations: {
      title: 'Conversations',
      value: String(appData.workflows.chat.conversations.length),
      detail: `${recentConversations[0] ? formatDate(recentConversations[0].updatedAt) : 'No activity yet'}`,
    },
    focus: {
      title: 'Focus',
      value: focusResult ? 'Ready' : 'Idle',
      detail: 'Use the focus helper to generate a reset plan.',
    },
    health: {
      title: 'Health',
      value: healthBundle.summary ? 'Prepared' : 'Idle',
      detail: 'Safe structured health summaries stay local.',
    },
  }

  const productivityCards = [
    {
      label: 'Pinned Memory',
      value: String(appData.memory.filter((entry) => entry.pinned).length),
      detail: 'High-signal context kept at the top.',
    },
    {
      label: 'Active Tasks',
      value: String(notesWorkflow.taskItems.filter((task) => !task.completed).length),
      detail: `${notesWorkflow.taskItems.filter(isOverdueTask).length} overdue tasks need attention.`,
    },
    {
      label: 'Completed Tasks',
      value: String(notesWorkflow.taskItems.filter((task) => task.completed).length),
      detail: 'Useful for cleanup and weekly review.',
    },
    {
      label: 'Recent Activity',
      value: String(appData.workflows.activityLog.slice(0, 7).length),
      detail: 'Local actions are tracked for quick context.',
    },
  ]

  const visibleQuickActions = appData.workflows.dashboard.quickActionIds
    .map((id) => availableQuickActions.find((action) => action.id === id))
    .filter((action): action is NonNullable<typeof action> => Boolean(action))

  const collapsedSections = new Set(appData.workflows.dashboard.collapsedSections)

  const isSectionCollapsed = (section: DashboardSectionId) => collapsedSections.has(section)

  const toggleDashboardSection = async (section: DashboardSectionId) => {
    await updateAppData(
      (current) => {
        const set = new Set(current.workflows.dashboard.collapsedSections)
        if (set.has(section)) {
          set.delete(section)
        } else {
          set.add(section)
        }

        return {
          ...current,
          workflows: {
            ...current.workflows,
            dashboard: {
              ...current.workflows.dashboard,
              collapsedSections: Array.from(set),
            },
          },
        }
      },
      'Dashboard layout updated.',
      'success',
      false,
      true,
    )
  }

  const updateQuickActions = async (id: QuickActionId) => {
    await updateAppData(
      (current) => {
        const currentIds = current.workflows.dashboard.quickActionIds
        const nextIds = currentIds.includes(id)
          ? currentIds.filter((item) => item !== id)
          : [...currentIds, id]

        return {
          ...current,
          workflows: {
            ...current.workflows,
            dashboard: {
              ...current.workflows.dashboard,
              quickActionIds: nextIds,
            },
          },
        }
      },
      'Quick actions updated.',
      'success',
      false,
      true,
    )
  }

  const updatePinnedWidget = async (id: DashboardWidgetId) => {
    await updateAppData(
      (current) => {
        const currentIds = current.workflows.dashboard.pinnedWidgets
        const nextIds = currentIds.includes(id)
          ? currentIds.filter((item) => item !== id)
          : [...currentIds, id]

        return {
          ...current,
          workflows: {
            ...current.workflows,
            dashboard: {
              ...current.workflows.dashboard,
              pinnedWidgets: nextIds,
            },
          },
        }
      },
      'Pinned widgets updated.',
      'success',
      false,
      true,
    )
  }

  const memorySuggestion = detectMemoryCategorySuggestion(
    manualMemoryTitle,
    manualMemoryContent,
  )

  const globalSearchResults = useMemo<SearchResult[]>(() => {
    const query = globalSearchQuery.trim().toLowerCase()
    if (!query) {
      return []
    }

    const results: SearchResult[] = []

    for (const entry of appData.memory) {
      const haystack = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase()
      if (haystack.includes(query)) {
        results.push({
          id: `memory-${entry.id}`,
          title: entry.title,
          detail: `Memory · ${entry.category}`,
          type: 'memory',
          action: () => {
            setActiveView('memory')
            setGlobalSearchOpen(false)
            setMemorySearch(entry.title)
            setExpandedMemoryIds((current) =>
              current.includes(entry.id) ? current : [...current, entry.id],
            )
          },
        })
      }
    }

    for (const task of notesWorkflow.taskItems) {
      if (`${task.label} ${task.category}`.toLowerCase().includes(query)) {
        results.push({
          id: `task-${task.id}`,
          title: task.label,
          detail: `Task · ${task.category}${task.dueDate ? ` · due ${task.dueDate}` : ''}`,
          type: 'task',
          action: () => {
            setActiveView('notes')
            setGlobalSearchOpen(false)
            setNotesTab('tasks')
            setNotesWorkflow((current) => ({
              ...current,
              taskSearch: task.label,
            }))
          },
        })
      }
    }

    if (
      `${notesWorkflow.input} ${notesWorkflow.cleanText}`.toLowerCase().includes(query)
    ) {
      results.push({
        id: 'note-workflow',
        title: 'Notes workflow',
        detail: 'Notes · current draft and cleaned output',
        type: 'note',
        action: () => {
          setActiveView('notes')
          setGlobalSearchOpen(false)
        },
      })
    }

    for (const conversation of appData.workflows.chat.conversations) {
      const messageText = conversation.messages.map((message) => message.content).join(' ')
      if (`${conversation.title} ${messageText}`.toLowerCase().includes(query)) {
        results.push({
          id: `conversation-${conversation.id}`,
          title: conversation.title,
          detail: `Conversation · ${formatDate(conversation.updatedAt)}`,
          type: 'conversation',
          action: () => {
            setActiveView('chat')
            setGlobalSearchOpen(false)
            void switchConversation(conversation.id)
          },
        })
      }
    }

    return results.slice(0, 25)
  }, [appData.memory, appData.workflows.chat.conversations, globalSearchQuery, notesWorkflow])

  const commandPaletteResults = useMemo(() => {
    const actions = [
      {
        id: 'go-dashboard',
        label: 'Open Dashboard',
        detail: 'Jump to the overview screen.',
        run: () => setActiveView('dashboard'),
      },
      {
        id: 'go-chat',
        label: 'Open Chat Assistant',
        detail: 'Jump to saved conversations.',
        run: () => setActiveView('chat'),
      },
      {
        id: 'go-notes',
        label: 'Open Notes Workflow',
        detail: 'Jump to editable notes, shopping, and tasks.',
        run: () => setActiveView('notes'),
      },
      {
        id: 'go-memory',
        label: 'Open Memory Manager',
        detail: 'Jump to local memory search and editing.',
        run: () => setActiveView('memory'),
      },
      {
        id: 'go-settings',
        label: 'Open Settings',
        detail: 'Jump to local-first settings and backup tools.',
        run: () => setActiveView('settings'),
      },
      {
        id: 'new-conversation',
        label: 'Create Conversation',
        detail: 'Start a fresh saved chat thread.',
        run: () => void createConversation(),
      },
      {
        id: 'global-search',
        label: 'Open Global Search',
        detail: 'Search memory, tasks, notes, and conversations.',
        run: () => setGlobalSearchOpen(true),
      },
      {
        id: 'export-backup',
        label: 'Export Full Backup',
        detail: 'Download the current local data JSON.',
        run: () => void exportFullBackup(),
      },
      {
        id: 'shortcuts',
        label: 'Show Keyboard Shortcuts',
        detail: 'Open the shortcuts reference.',
        run: () => setShortcutsOpen(true),
      },
    ]

    const query = commandPaletteQuery.trim().toLowerCase()
    return actions.filter((action) =>
      `${action.label} ${action.detail}`.toLowerCase().includes(query),
    )
  }, [commandPaletteQuery])

  const duplicateMemoryMap = useMemo(() => {
    const map = new Map<string, string[]>()

    for (const entry of appData.memory) {
      const matches = appData.memory
        .filter((other) => other.id !== entry.id)
        .filter((other) => {
          const sameTitle = other.title.trim().toLowerCase() === entry.title.trim().toLowerCase()
          const sameContentStart =
            other.content.trim().slice(0, 80).toLowerCase() ===
            entry.content.trim().slice(0, 80).toLowerCase()
          return sameTitle || sameContentStart
        })
        .map((other) => other.id)

      map.set(entry.id, matches)
    }

    return map
  }, [appData.memory])

  const relatedMemoryMap = useMemo(() => {
    const map = new Map<string, MemoryEntry[]>()

    for (const entry of appData.memory) {
      const terms = new Set(
        `${entry.title} ${entry.tags.join(' ')}`
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 4),
      )

      const related = appData.memory
        .filter((other) => other.id !== entry.id)
        .map((other) => {
          const otherText = `${other.title} ${other.content} ${other.tags.join(' ')}`.toLowerCase()
          const score = Array.from(terms).reduce(
            (total, term) => total + (otherText.includes(term) ? 1 : 0),
            0,
          )
          return { other, score }
        })
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map((item) => item.other)

      map.set(entry.id, related)
    }

    return map
  }, [appData.memory])

  const renderDashboardSection = (
    section: DashboardSectionId,
    title: string,
    eyebrow: string,
    content: React.ReactNode,
  ) => (
    <div className="panel panel--span-3">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void toggleDashboardSection(section)}
        >
          {isSectionCollapsed(section) ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isSectionCollapsed(section) && content}
    </div>
  )

  if (loading) {
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <p className="eyebrow">KCxModeAI</p>
          <h1>Loading your local desktop workspace</h1>
          <p>{statusMessage}</p>
        </div>
      </main>
    )
  }

  return (
    <div
      className={[
        sidebarCollapsed ? 'app-shell app-shell--collapsed' : 'app-shell',
        settingsDraft.accessibility.largerText ? 'accessibility-large-text' : '',
        settingsDraft.accessibility.higherContrast ? 'accessibility-high-contrast' : '',
        settingsDraft.accessibility.simplifiedWording ? 'accessibility-simplified' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-top">
            <div>
              <p className="eyebrow">Created by KCx</p>
              <h1 className="brand-title">KCxModeAI</h1>
            </div>
            <button
              type="button"
              className="ghost-button ghost-button--icon"
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              {sidebarCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
          {!sidebarCollapsed && (
            <>
              <p className="brand-copy">
                A polished local-first desktop productivity ecosystem for notes,
                tasks, memory, planning, and practical workflow support.
              </p>
              <div className="status-row">
                <span className="status-pill status-pill--good">Local-first</span>
                <span className="status-pill">{activeProviderLabel}</span>
              </div>
            </>
          )}
        </div>

        <nav className="nav-list" aria-label="Primary">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={view.id === activeView ? 'nav-button nav-button--active' : 'nav-button'}
              onClick={() => setActiveView(view.id)}
              title={sidebarCollapsed ? view.label : undefined}
            >
              {sidebarCollapsed ? (
                <span className="nav-compact-label">{view.compact}</span>
              ) : (
                <>
                  <span>{view.label}</span>
                  <small>{view.short}</small>
                </>
              )}
            </button>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-footer__actions">
              <button type="button" className="ghost-button" onClick={() => setCommandPaletteOpen(true)}>
                Command Palette
              </button>
              <button type="button" className="ghost-button" onClick={() => setGlobalSearchOpen(true)}>
                Quick Search
              </button>
            </div>
            <p>{isSaving ? 'Saving local changes...' : statusMessage}</p>
            <small>{appInfo.dataFilePath}</small>
          </div>
        )}
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            <p className="eyebrow">Release Candidate Local-First Layer</p>
            <h2>{views.find((view) => view.id === activeView)?.label}</h2>
            <p className="screen-copy">{currentView.description}</p>
          </div>
          <div className="workspace-meta">
            <div className="meta-chip">
              <span>Conversations</span>
              <strong>{appData.workflows.chat.conversations.length}</strong>
            </div>
            <div className="meta-chip">
              <span>Tasks</span>
              <strong>{notesWorkflow.taskItems.filter((task) => !task.completed).length}</strong>
            </div>
            <div className="meta-chip">
              <span>Theme</span>
              <strong>{themePreference === 'godzilla' ? 'KCx' : 'Midnight'}</strong>
            </div>
          </div>
        </header>

        <div className="screen-banner">
          <div>
            <strong>{currentView.hint}</strong>
            <p>{currentView.shortcut ?? statusMessage}</p>
          </div>
          <span className="screen-banner__tag">
            {isSaving ? 'Saving locally' : 'Productivity layer'}
          </span>
        </div>

        <div className="workspace-scroll">
          {activeView === 'dashboard' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Summary</p>
                    <h3>Productivity Snapshot</h3>
                  </div>
                </div>
                <div className="stat-grid">
                  {productivityCards.map((card) => (
                    <article key={card.label} className="stat-card">
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                      <p>{card.detail}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Personalization</p>
                    <h3>Dashboard Controls</h3>
                  </div>
                </div>
                <div className="control-list">
                  {availableQuickActions.map((action) => (
                    <label key={action.id} className="toggle-row toggle-row--panel">
                      <input
                        type="checkbox"
                        checked={appData.workflows.dashboard.quickActionIds.includes(action.id)}
                        onChange={() => void updateQuickActions(action.id)}
                      />
                      <span>{action.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {renderDashboardSection(
                'quick_actions',
                'Quick Actions',
                'Workflow',
                <div className="action-grid">
                  {visibleQuickActions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="action-card"
                      onClick={() => {
                        if (item.id === 'global_search') {
                          setGlobalSearchOpen(true)
                          return
                        }

                        if (item.id === 'focus_reset') {
                          setActiveView('focus')
                          setFocusInput(helperExamples.focus)
                          return
                        }

                        if (item.id === 'health_summary') {
                          setHealthInput(helperExamples.health)
                        }

                        if (item.id === 'persistent_notes') {
                          setNotesWorkflow((current) => ({
                            ...current,
                            input: current.input || helperExamples.notes,
                          }))
                        }

                        if (item.view) {
                          setActiveView(item.view)
                        }
                      }}
                    >
                      <span className="action-card__meta">Quick Action</span>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </button>
                  ))}
                </div>,
              )}

              {renderDashboardSection(
                'pinned_widgets',
                'Pinned Widgets',
                'Widgets',
                <>
                  <div className="widget-config-row">
                    {(Object.keys(dashboardWidgets) as DashboardWidgetId[]).map((widgetId) => (
                      <label key={widgetId} className="toggle-row toggle-row--panel">
                        <input
                          type="checkbox"
                          checked={appData.workflows.dashboard.pinnedWidgets.includes(widgetId)}
                          onChange={() => void updatePinnedWidget(widgetId)}
                        />
                        <span>{dashboardWidgets[widgetId].title}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mini-grid">
                    {appData.workflows.dashboard.pinnedWidgets.map((widgetId) => {
                      const widget = dashboardWidgets[widgetId]
                      return (
                        <article key={widgetId} className="mini-card">
                          <span>{widget.title}</span>
                          <strong>{widget.value}</strong>
                          <p>{widget.detail}</p>
                        </article>
                      )
                    })}
                  </div>
                </>,
              )}

              {renderDashboardSection(
                'productivity',
                'Productivity Summary',
                'Summary',
                <div className="detail-grid">
                  <article className="mini-card">
                    <span>Task Health</span>
                    <p>
                      {notesWorkflow.taskItems.filter(isOverdueTask).length} overdue,{' '}
                      {notesWorkflow.taskItems.filter((task) => task.pinned).length} pinned,{' '}
                      {notesWorkflow.taskItems.filter((task) => task.completed).length} completed.
                    </p>
                  </article>
                  <article className="mini-card">
                    <span>Conversation Health</span>
                    <p>
                      {recentConversations[0]
                        ? `Most recent conversation updated ${formatDate(recentConversations[0].updatedAt)}.`
                        : 'No conversation activity yet.'}
                    </p>
                  </article>
                  <article className="mini-card">
                    <span>Memory Health</span>
                    <p>
                      {appData.memory.filter((entry) => entry.favorite).length} favorites and{' '}
                      {appData.memory.filter((entry) => entry.pinned).length} pinned entries are ready for reuse.
                    </p>
                  </article>
                </div>,
              )}

              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Workflows</p>
                    <h3>Smart Routines (Manual Run)</h3>
                  </div>
                </div>
                <p className="field-hint">
                  Workflows run locally and only after user action. No autonomous execution or background services are active.
                </p>
                <div className="mini-grid">
                  {appData.workflows.routines.map((routine) => (
                    <article key={routine.id} className="mini-card">
                      <span>{routine.name}</span>
                      <p>{routine.description}</p>
                      <p>
                        Status: {routine.status}
                        {routine.lastRunAt ? ` | Last run: ${formatDate(routine.lastRunAt)}` : ''}
                      </p>
                      <div className="button-row button-row--tight">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void toggleWorkflowEnabled(routine.id)}
                        >
                          {routine.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setSelectedWorkflowId(routine.id)}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={!routine.enabled || runningWorkflowId !== null}
                          onClick={() => void runWorkflowNow(routine)}
                        >
                          {runningWorkflowId === routine.id ? 'Running...' : 'Run Now'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {selectedRoutine && (
                  <div className="related-memory-box">
                    <strong>{selectedRoutine.name} steps</strong>
                    <ul className="structured-list">
                      {selectedRoutine.steps.map((step) => (
                        <li key={step.id}>
                          {step.title}: {step.detail}
                          {step.delaySeconds ? ` (${step.delaySeconds}s)` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="field-hint">{routineStatusText}</p>
              </div>

              {renderDashboardSection(
                'recent_activity',
                'Recent Activity',
                'Activity',
                <div className="activity-list">
                  {appData.workflows.activityLog.length === 0 && (
                    <EmptyState
                      title="No recent activity yet"
                      copy="Workflow events such as exports, memory saves, and task changes will appear here."
                    />
                  )}
                  {appData.workflows.activityLog.slice(0, 8).map((entry) => (
                    <article key={entry.id} className="activity-card">
                      <div>
                        <strong>{entry.title}</strong>
                        <p>{entry.detail}</p>
                      </div>
                      <small>{formatDate(entry.createdAt)}</small>
                    </article>
                  ))}
                </div>,
              )}
            </section>
          )}

          {activeView === 'chat' && (
            <section className="panel-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Conversations</p>
                    <h3>Saved Threads</h3>
                  </div>
                  <button type="button" className="primary-button" onClick={() => void createConversation()}>
                    New Conversation
                  </button>
                </div>
                <div className="conversation-list">
                  {recentConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className={
                        conversation.id === activeConversation?.id
                          ? 'conversation-card conversation-card--active'
                          : 'conversation-card'
                      }
                      onClick={() => void switchConversation(conversation.id)}
                    >
                      <div>
                        <strong>{conversation.title}</strong>
                        <p>
                          {conversation.messages.length} messages
                          {conversation.pinned ? ' · pinned' : ''}
                        </p>
                      </div>
                      <small>{formatDate(conversation.updatedAt)}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel panel--span-2 panel--stretch">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Chat Assistant</p>
                    <h3>{activeConversation?.title ?? 'Conversation'}</h3>
                  </div>
                  <div className="button-row button-row--tight">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => activeConversation ? void exportConversation(activeConversation) : undefined}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        activeConversation
                          ? void updateAppData(
                              (current) =>
                                recordActivity(
                                  {
                                    ...current,
                                    workflows: {
                                      ...current.workflows,
                                      chat: {
                                        ...current.workflows.chat,
                                        conversations: current.workflows.chat.conversations.map(
                                          (conversation) =>
                                            conversation.id === activeConversation.id
                                              ? {
                                                  ...conversation,
                                                  pinned: !conversation.pinned,
                                                  updatedAt: nowIso(),
                                                }
                                              : conversation,
                                        ),
                                      },
                                    },
                                  },
                                  'conversation_saved',
                                  activeConversation.pinned
                                    ? 'Conversation unpinned'
                                    : 'Conversation pinned',
                                  activeConversation.title,
                                  activeConversation.id,
                                ),
                              activeConversation.pinned
                                ? 'Conversation unpinned.'
                                : 'Conversation pinned.',
                              'success',
                              true,
                            )
                          : undefined
                      }
                    >
                      {activeConversation?.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button type="button" className="ghost-button" onClick={() => void handleClearConversation()}>
                      Clear
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => (activeConversation ? void deleteConversation(activeConversation.id) : undefined)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="conversation-title-row">
                  <input
                    value={editingConversationTitle}
                    onChange={(event) => setEditingConversationTitle(event.target.value)}
                    placeholder="Conversation title"
                  />
                  <button type="button" className="ghost-button" onClick={() => void renameConversation()}>
                    Rename
                  </button>
                </div>

                <div className="chat-thread">
                  {activeConversation?.messages.length === 0 && (
                    <EmptyState
                      title="No conversation messages yet"
                      copy="Ask for task planning, note cleanup, or a calm focus reset to get started."
                      detail="Conversations are saved locally and can be renamed or exported anytime."
                    />
                  )}

                  {activeConversation?.messages.map((message) => (
                    <article
                      key={message.id}
                      className={
                        message.role === 'user'
                          ? 'chat-bubble chat-bubble--user'
                          : 'chat-bubble chat-bubble--assistant'
                      }
                    >
                      <div className="chat-meta">
                        <strong>{message.role === 'user' ? 'You' : 'KCxModeAI'}</strong>
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                      {message.response ? (
                        <ResultCard
                          response={message.response}
                          compact
                          onCopy={() =>
                            void handleCopy(
                              responseToCopyText(message.response!),
                              'Response copied from chat.',
                            )
                          }
                          onSave={() => void saveResponseToMemory(message.response!, 'chat_assistant')}
                        />
                      ) : (
                        <p className="user-message">{message.content}</p>
                      )}
                    </article>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Compose</p>
                    <h3>Send a Prompt</h3>
                  </div>
                </div>
                <label className="field">
                  <span>Message</span>
                  <textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => handleCtrlEnter(event, () => void handleSendChat())}
                    rows={8}
                    placeholder="Try: summarize this note, extract tasks, or help me restart focus mode."
                  />
                </label>
                <p className="field-hint">Ctrl+Enter sends the message.</p>
                <p className="field-hint">Provider status: {chatProviderHint}</p>
                {chatRuntimeStatus && <p className="field-hint">{chatRuntimeStatus}</p>}
                <p className="field-hint">
                  Workflow suggestions: Morning Routine, Focus Session, Daily Planning. Launch is always manual.
                </p>
                <div className="button-row button-row--tight">
                  {appData.workflows.routines.slice(0, 3).map((routine) => (
                    <button
                      key={routine.id}
                      type="button"
                      className="ghost-button"
                      disabled={!routine.enabled || runningWorkflowId !== null}
                      onClick={() => void runWorkflowNow(routine)}
                    >
                      Run {routine.name}
                    </button>
                  ))}
                </div>
                <div className="button-row button-row--wrap">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!composer.trim() || isSendingChat}
                    onClick={() => void handleSendChat()}
                  >
                    {isSendingChat ? 'Working...' : 'Send'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!activeConversation?.messages.some((message) => message.response)}
                    onClick={() =>
                      activeConversation
                        ? void handleCopy(
                            buildConversationExportText(activeConversation),
                            'Conversation copied.',
                          )
                        : undefined
                    }
                  >
                    Copy Conversation
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeView === 'health' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Health Helper</p>
                    <h3>Organize Health Notes Safely</h3>
                  </div>
                </div>
                <label className="field">
                  <span>Paste health notes</span>
                  <textarea
                    value={healthInput}
                    onChange={(event) => setHealthInput(event.target.value)}
                    onKeyDown={(event) => handleCtrlEnter(event, runHealthAnalysis)}
                    rows={12}
                  />
                </label>
                <p className="field-hint">Ctrl+Enter runs the main health summary.</p>
                <div className="button-row button-row--wrap">
                  <button type="button" className="primary-button" onClick={runHealthAnalysis}>
                    Generate Summary
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!healthBundle.summary}
                    onClick={() =>
                      healthBundle.summary
                        ? void handleCopy(
                            responseToCopyText(healthBundle.summary),
                            'Health summary copied.',
                          )
                        : undefined
                    }
                  >
                    Copy Result
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!healthBundle.summary}
                    onClick={() =>
                      healthBundle.summary
                        ? void saveResponseToMemory(
                            healthBundle.summary,
                            'health_helper',
                            'health_context',
                          )
                        : undefined
                    }
                  >
                    Save to Memory
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setHealthInput('')
                      setHealthBundle(emptyHealthBundle())
                      updateStatus('Health helper cleared.')
                    }}
                  >
                    Clear Input
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Safety</p>
                    <h3>Health Guardrails</h3>
                  </div>
                </div>
                <ul className="detail-list">
                  <li>No diagnosis, prescribing, or replacement for clinician advice.</li>
                  <li>Very low or very high glucose text is flagged carefully.</li>
                  <li>Doctor-ready output is framed as an editable note draft.</li>
                  <li>Use urgent wording only when the note itself suggests it may be appropriate.</li>
                </ul>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Diagnostics</p>
                    <h3>Compact Local Status</h3>
                  </div>
                </div>
                <ul className="detail-list detail-list--dense">
                  <li>Runtime mode: {diagnosticsSummary.runtime}</li>
                  <li>Storage mode: {diagnosticsSummary.storageMode}</li>
                  <li>Local AI service status: {diagnosticsSummary.ollamaStatus}</li>
                  <li>Workflows: {diagnosticsSummary.workflowCount}</li>
                  <li>Memories: {diagnosticsSummary.memoryCount}</li>
                  <li>Estimated storage: {diagnosticsSummary.storageEstimate}</li>
                  <li>Local AI state: {diagnosticsSummary.localAiState}</li>
                  <li>Local-only mode: {diagnosticsSummary.localOnlyMode}</li>
                  <li>AI-safe memory count: {diagnosticsSummary.aiSafeMemoryCount}</li>
                  <li>Sync-eligible count: {diagnosticsSummary.syncEligibleCount}</li>
                  <li>Export-safe count: {diagnosticsSummary.exportSafeCount}</li>
                  <li>Helper isolation status: {diagnosticsSummary.helperIsolation}</li>
                  <li>Last recovery event: {diagnosticsSummary.lastRecoveryEvent}</li>
                </ul>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Sections</p>
                    <h3>Health Summary Snapshot</h3>
                  </div>
                </div>
                {healthBundle.summary ? (
                  <div className="mini-grid">
                    {healthSectionCards.map((card) => (
                      <article key={card.title} className="mini-card">
                        <span>{card.title}</span>
                        <p>{card.content}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No health summary yet"
                    copy="Run Health Helper to organize readings, patterns, medicine notes, and safety wording."
                  />
                )}
              </div>

              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Structured Result</p>
                    <h3>Health Notes Summary</h3>
                  </div>
                </div>
                {healthBundle.summary ? (
                  <ResultCard
                    response={healthBundle.summary}
                    onCopy={() =>
                      void handleCopy(
                        responseToCopyText(healthBundle.summary!),
                        'Health summary copied.',
                      )
                    }
                    onSave={() =>
                      void saveResponseToMemory(
                        healthBundle.summary!,
                        'health_helper',
                        'health_context',
                      )
                    }
                  />
                ) : (
                  <EmptyState
                    title="No structured summary yet"
                    copy="Paste health notes and run Health Helper to generate a local summary."
                  />
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Doctor View</p>
                    <h3>Doctor-Ready Note</h3>
                  </div>
                </div>
                {healthBundle.doctor ? (
                  <ResultCard
                    response={healthBundle.doctor}
                    compact
                    onCopy={() =>
                      void handleCopy(
                        responseToCopyText(healthBundle.doctor!),
                        'Doctor-ready note copied.',
                      )
                    }
                    onSave={() =>
                      void saveResponseToMemory(
                        healthBundle.doctor!,
                        'health_doctor_note',
                        'health_context',
                      )
                    }
                  />
                ) : (
                  <EmptyState
                    title="No doctor-ready note yet"
                    copy="A doctor-ready note appears after you run the health summary."
                  />
                )}
              </div>
            </section>
          )}

          {activeView === 'notes' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Notes Workflow</p>
                    <h3>Persistent Notes and Planning</h3>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Template</span>
                    <select
                      value={notesWorkflow.template}
                      onChange={(event) => {
                        const template = event.target.value as NoteTemplate
                        setNotesWorkflow((current) => ({
                          ...current,
                          template,
                          input:
                            current.input.trim().length === 0
                              ? applyNotesTemplate(template)
                              : current.input,
                          updatedAt: nowIso(),
                        }))
                      }}
                    >
                      <option value="blank">blank</option>
                      <option value="meeting_notes">meeting notes</option>
                      <option value="doctor_note">doctor note</option>
                      <option value="grocery_planning">grocery planning</option>
                      <option value="focus_session">focus session planning</option>
                      <option value="checklist">checklist</option>
                    </select>
                  </label>
                  <div className="template-note">
                    <strong>Templates</strong>
                    <p>Switch templates to seed the note draft with a more structured starting format.</p>
                  </div>
                </div>
                <label className="field">
                  <span>Paste or draft notes</span>
                  <textarea
                    value={notesWorkflow.input}
                    onChange={(event) =>
                      setNotesWorkflow((current) => ({
                        ...current,
                        input: event.target.value,
                        updatedAt: nowIso(),
                      }))
                    }
                    onKeyDown={(event) => handleCtrlEnter(event, runNotesAnalysis)}
                    rows={12}
                  />
                </label>
                <p className="field-hint">Ctrl+Enter analyzes the notes and refreshes all sections.</p>
                <div className="button-row button-row--wrap">
                  <button type="button" className="primary-button" onClick={runNotesAnalysis}>
                    Analyze Notes
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      void handleCopy(
                        buildNotesExportText(notesWorkflow),
                        'Notes workflow copied for export.',
                      )
                    }
                  >
                    Copy / Export Workflow
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      void saveTextToMemory(
                        'Notes Workflow Snapshot',
                        buildNotesExportText(notesWorkflow),
                        'note',
                        'notes_workflow',
                        ['workflow', 'notes'],
                      )
                    }
                  >
                    Save Workflow to Memory
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setNotesWorkflow({
                        ...defaultDataSnapshot.workflows.notes,
                        input: settingsDraft.notesRememberDrafts ? '' : helperExamples.notes,
                      })
                      updateStatus('Notes workflow cleared.', 'success', true)
                    }}
                  >
                    Clear Workflow
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Persistence</p>
                    <h3>Workflow Status</h3>
                  </div>
                </div>
                <ul className="detail-list">
                  <li>Notes draft persistence is currently {settingsDraft.notesRememberDrafts ? 'enabled' : 'disabled'}.</li>
                  <li>Shopping and task completion states are saved with the workflow.</li>
                  <li>Task filters, search, and active notes tab are remembered locally.</li>
                  <li>
                    Last notes update:{' '}
                    {notesWorkflow.updatedAt ? formatDate(notesWorkflow.updatedAt) : 'not yet saved'}
                  </li>
                </ul>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Editable Sections</p>
                    <h3>Workflow Output</h3>
                  </div>
                </div>
                <div className="tab-row">
                  <button
                    type="button"
                    className={notesTab === 'clean' ? 'tab-button tab-button--active' : 'tab-button'}
                    onClick={() => setNotesTab('clean')}
                  >
                    Clean Notes
                  </button>
                  <button
                    type="button"
                    className={notesTab === 'shopping' ? 'tab-button tab-button--active' : 'tab-button'}
                    onClick={() => setNotesTab('shopping')}
                  >
                    Shopping List
                  </button>
                  <button
                    type="button"
                    className={notesTab === 'tasks' ? 'tab-button tab-button--active' : 'tab-button'}
                    onClick={() => setNotesTab('tasks')}
                  >
                    Task System
                  </button>
                </div>

                {notesTab === 'clean' && (
                  <div className="workflow-section">
                    <label className="field">
                      <span>Editable clean notes</span>
                      <textarea
                        value={notesWorkflow.cleanText}
                        onChange={(event) =>
                          setNotesWorkflow((current) => ({
                            ...current,
                            cleanText: event.target.value,
                            updatedAt: nowIso(),
                          }))
                        }
                        rows={12}
                        placeholder="Run Analyze Notes to generate a clean draft, then edit it here."
                      />
                    </label>
                    <div className="button-row button-row--wrap">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          void handleCopy(notesWorkflow.cleanText || 'No clean notes yet.', 'Clean notes copied.')
                        }
                      >
                        Copy Clean Notes
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          void saveTextToMemory(
                            'Clean Notes',
                            notesWorkflow.cleanText || 'No clean notes yet.',
                            'note',
                            'notes_clean',
                            ['notes'],
                          )
                        }
                      >
                        Save to Memory
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => clearNotesSection('clean')}
                      >
                        Reset Section
                      </button>
                    </div>
                  </div>
                )}

                {notesTab === 'shopping' && (
                  <div className="workflow-section">
                    <ChecklistEditor
                      title="Editable shopping items"
                      items={notesWorkflow.shoppingItems}
                      onToggle={(id) =>
                        updateChecklistItem('shoppingItems', id, (item) => ({
                          ...item,
                          completed: !item.completed,
                        }))
                      }
                      onChange={(id, value) =>
                        updateChecklistItem('shoppingItems', id, (item) => ({
                          ...item,
                          label: value,
                        }))
                      }
                      onRemove={(id) =>
                        setNotesWorkflow((current) => ({
                          ...current,
                          shoppingItems: current.shoppingItems.filter((item) => item.id !== id),
                          updatedAt: nowIso(),
                        }))
                      }
                      onAdd={addChecklistItem}
                    />
                    <div className="button-row button-row--wrap">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          void handleCopy(
                            notesWorkflow.shoppingItems
                              .map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.label}`)
                              .join('\n') || 'No shopping items yet.',
                            'Shopping list copied.',
                          )
                        }
                      >
                        Copy Shopping List
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          void saveTextToMemory(
                            'Shopping List',
                            notesWorkflow.shoppingItems
                              .map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.label}`)
                              .join('\n') || 'No shopping items yet.',
                            'shopping',
                            'notes_shopping',
                            ['shopping'],
                          )
                        }
                      >
                        Save to Memory
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => clearNotesSection('shopping')}
                      >
                        Reset Section
                      </button>
                    </div>
                  </div>
                )}

                {notesTab === 'tasks' && (
                  <div className="workflow-section">
                    <div className="task-toolbar">
                      <label className="field">
                        <span>Task search</span>
                        <input
                          value={notesWorkflow.taskSearch}
                          onChange={(event) =>
                            setNotesWorkflow((current) => ({
                              ...current,
                              taskSearch: event.target.value,
                              updatedAt: nowIso(),
                            }))
                          }
                          placeholder="Search tasks"
                        />
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <select
                          value={notesWorkflow.taskFilterStatus}
                          onChange={(event) =>
                            setNotesWorkflow((current) => ({
                              ...current,
                              taskFilterStatus: event.target.value as TaskFilterStatus,
                              updatedAt: nowIso(),
                            }))
                          }
                        >
                          <option value="all">all</option>
                          <option value="active">active</option>
                          <option value="completed">completed</option>
                          <option value="overdue">overdue</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Category</span>
                        <select
                          value={notesWorkflow.taskFilterCategory}
                          onChange={(event) =>
                            setNotesWorkflow((current) => ({
                              ...current,
                              taskFilterCategory: event.target.value,
                              updatedAt: nowIso(),
                            }))
                          }
                        >
                          <option value="all">all</option>
                          {taskCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="button-row button-row--wrap">
                      <button type="button" className="primary-button" onClick={addTaskItem}>
                        Add Task
                      </button>
                      <button type="button" className="ghost-button" onClick={bulkCompleteVisibleTasks}>
                        Bulk Complete Visible
                      </button>
                      <button type="button" className="ghost-button" onClick={bulkDeleteCompletedTasks}>
                        Delete Completed
                      </button>
                      <button type="button" className="ghost-button" onClick={() => clearNotesSection('tasks')}>
                        Reset Task Section
                      </button>
                    </div>

                    <div className="task-sections">
                      <div className="task-section">
                        <div className="task-section__header">
                          <strong>Active Tasks</strong>
                          <span>{activeTasks.length}</span>
                        </div>
                        {activeTasks.length === 0 && (
                          <EmptyState
                            title="No active tasks"
                            copy="Add a task or adjust the current filters."
                          />
                        )}
                        {activeTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            overdue={isOverdueTask(task)}
                            onToggle={() =>
                              updateTaskItem(task.id, (item) => ({
                                ...item,
                                completed: !item.completed,
                                updatedAt: nowIso(),
                              }))
                            }
                            onUpdate={(patch) =>
                              updateTaskItem(task.id, (item) => ({
                                ...item,
                                ...patch,
                                updatedAt: nowIso(),
                              }))
                            }
                            onDelete={() =>
                              setNotesWorkflow((current) => ({
                                ...current,
                                taskItems: current.taskItems.filter((item) => item.id !== task.id),
                                updatedAt: nowIso(),
                              }))
                            }
                          />
                        ))}
                      </div>

                      <div className="task-section">
                        <div className="task-section__header">
                          <strong>Completed Tasks</strong>
                          <span>{completedTasks.length}</span>
                        </div>
                        {completedTasks.length === 0 && (
                          <EmptyState
                            title="No completed tasks"
                            copy="Completed tasks will appear here for review and cleanup."
                          />
                        )}
                        {completedTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            overdue={false}
                            onToggle={() =>
                              updateTaskItem(task.id, (item) => ({
                                ...item,
                                completed: !item.completed,
                                updatedAt: nowIso(),
                              }))
                            }
                            onUpdate={(patch) =>
                              updateTaskItem(task.id, (item) => ({
                                ...item,
                                ...patch,
                                updatedAt: nowIso(),
                              }))
                            }
                            onDelete={() =>
                              setNotesWorkflow((current) => ({
                                ...current,
                                taskItems: current.taskItems.filter((item) => item.id !== task.id),
                                updatedAt: nowIso(),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === 'focus' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Focus Helper</p>
                    <h3>Supportive KCxMode Coaching</h3>
                  </div>
                </div>
                <label className="field">
                  <span>What is pulling you off track?</span>
                  <textarea
                    value={focusInput}
                    onChange={(event) => setFocusInput(event.target.value)}
                    onKeyDown={(event) =>
                      handleCtrlEnter(event, () =>
                        runFocusedHelper(
                          focusInput,
                          'focus_support',
                          setFocusResult,
                          'Focus coaching generated.',
                        ),
                      )
                    }
                    rows={10}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Focus preset</span>
                    <select
                      value={focusPreset}
                      onChange={(event) =>
                        setFocusPreset(
                          event.target.value as AppData['settings']['helperPreferences']['focusPreset'],
                        )
                      }
                    >
                      <option value="quick_reset">quick_reset</option>
                      <option value="deep_work">deep_work</option>
                      <option value="reentry">reentry</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Optional timer (minutes)</span>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={focusTimerMinutes}
                      onChange={(event) => setFocusTimerMinutes(Math.min(Math.max(Number(event.target.value) || 25, 5), 120))}
                    />
                  </label>
                </div>
                <p className="field-hint">Ctrl+Enter runs focus coaching.</p>
                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      runFocusedHelper(focusInput, 'focus_support', setFocusResult, 'Focus coaching generated.')
                        .then(() => setFocusCompletionSummary(`Completed ${focusPreset} session with ${focusTimerMinutes} minute timer preset.`))
                    }
                  >
                    Focus Coaching
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      runFocusedHelper(
                        focusInput,
                        'focus_support',
                        setFocusResult,
                        'Supportive message generated.',
                        'supportive',
                      )
                    }
                  >
                    Supportive Message
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      runFocusedHelper(
                        focusInput,
                        'godzilla_planning',
                        setFocusResult,
                        'Delay and friction ideas generated.',
                      )
                    }
                  >
                    Delay / Friction Ideas
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      const linked = appData.workflows.routines.find((item) => item.category === 'focus_session')
                      if (linked) {
                        void runWorkflowNow(linked)
                      } else {
                        updateStatus('Focus workflow template is not ready yet.', 'info', true)
                      }
                    }}
                  >
                    Run Linked Focus Workflow
                  </button>
                </div>
                {focusCompletionSummary && <p className="field-hint">{focusCompletionSummary}</p>}
                <p className="field-hint">
                  Focus Helper remains local rule-based and does not route to Ollama.
                </p>
              </div>

              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Result</p>
                    <h3>Focus Output</h3>
                  </div>
                </div>
                {focusResult ? (
                  <ResultCard
                    response={focusResult}
                    onCopy={() => void handleCopy(responseToCopyText(focusResult), 'Focus result copied.')}
                    onSave={() =>
                      void saveResponseToMemory(
                        focusResult,
                        'focus_helper',
                        'godzilla_mode_setting',
                      )
                    }
                  />
                ) : (
                  <EmptyState
                    title="No focus guidance yet"
                    copy="Generate coaching, a supportive message, or friction ideas for the next work block."
                  />
                )}
              </div>
            </section>
          )}

          {activeView === 'family' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Family Helper</p>
                    <h3>Calm Wording and Household Structure</h3>
                  </div>
                </div>
                <label className="field">
                  <span>Describe the situation</span>
                  <textarea
                    value={familyInput}
                    onChange={(event) => setFamilyInput(event.target.value)}
                    onKeyDown={(event) =>
                      handleCtrlEnter(event, () =>
                        runFocusedHelper(
                          familyInput,
                          'family_support',
                          setFamilyResult,
                          'Family guidance generated.',
                        ),
                      )
                    }
                    rows={10}
                  />
                </label>
                <label className="field">
                  <span>Reusable template</span>
                  <select
                    value={familyTemplate}
                    onChange={(event) =>
                      setFamilyTemplate(
                        event.target.value as AppData['settings']['helperPreferences']['familyTemplate'],
                      )
                    }
                  >
                    <option value="calm_boundary">calm_boundary</option>
                    <option value="routine_reset">routine_reset</option>
                    <option value="screen_time">screen_time</option>
                  </select>
                </label>
                <p className="field-hint">Ctrl+Enter generates guidance.</p>
                <p className="field-hint">
                  Family helper wording stays organizational and calm. It is not therapy or clinical guidance.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      runFocusedHelper(
                        familyInput,
                        'family_support',
                        setFamilyResult,
                        'Family guidance generated.',
                      )
                    }
                  >
                    Family Mode Guidance
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      runFocusedHelper(
                        familyInput,
                        'family_support',
                        setFamilyResult,
                        'Rules wording generated.',
                        'rules',
                      )
                    }
                  >
                    Rules Wording
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      runFocusedHelper(
                        familyInput,
                        'family_support',
                        setFamilyResult,
                        'Calm conflict wording generated.',
                        'conflict',
                      )
                    }
                  >
                    Calm Conflict Wording
                  </button>
                </div>
              </div>

              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Result</p>
                    <h3>Family Output</h3>
                  </div>
                </div>
                {familyResult ? (
                  <ResultCard
                    response={familyResult}
                    onCopy={() => void handleCopy(responseToCopyText(familyResult), 'Family result copied.')}
                    onSave={() => void saveResponseToMemory(familyResult, 'family_helper')}
                  />
                ) : (
                  <EmptyState
                    title="No family guidance yet"
                    copy="Generate calm family guidance, rule wording, or device structure ideas."
                  />
                )}
              </div>
            </section>
          )}

          {activeView === 'senior' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Senior Helper</p>
                    <h3>Simplify Instructions and Keep Them Clear</h3>
                  </div>
                </div>
                <label className="field">
                  <span>Paste a confusing instruction set</span>
                  <textarea
                    className={seniorEasyMode ? 'senior-easy-text' : ''}
                    value={seniorInput}
                    onChange={(event) => setSeniorInput(event.target.value)}
                    onKeyDown={(event) =>
                      handleCtrlEnter(event, () =>
                        runFocusedHelper(
                          seniorInput,
                          'senior_support',
                          setSeniorResult,
                          'Senior-friendly steps generated.',
                        ),
                      )
                    }
                    rows={10}
                  />
                </label>
                <label className="toggle-row toggle-row--panel">
                  <input
                    type="checkbox"
                    checked={seniorEasyMode}
                    onChange={(event) => setSeniorEasyMode(event.target.checked)}
                  />
                  <span>Easy mode layout (larger text support)</span>
                </label>
                <p className="field-hint">Ctrl+Enter simplifies the instructions.</p>
                <p className="field-hint">
                  Senior helper remains isolated and rule-based for safety.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      runFocusedHelper(
                        seniorInput,
                        'senior_support',
                        setSeniorResult,
                        'Senior-friendly steps generated.',
                      )
                    }
                  >
                    Simplify Instructions
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      runFocusedHelper(
                        seniorInput,
                        'senior_support',
                        setSeniorResult,
                        'Safety-focused helper text generated.',
                        'safety',
                      )
                    }
                  >
                    Safety-Focused Text
                  </button>
                </div>
              </div>

              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Result</p>
                    <h3>Senior Output</h3>
                  </div>
                </div>
                {seniorResult ? (
                  <ResultCard
                    response={seniorResult}
                    onCopy={() => void handleCopy(responseToCopyText(seniorResult), 'Senior result copied.')}
                    onSave={() => void saveResponseToMemory(seniorResult, 'senior_helper')}
                  />
                ) : (
                  <EmptyState
                    title="No senior guidance yet"
                    copy="Generate short, clearer, safety-first instructions."
                  />
                )}
              </div>
            </section>
          )}

          {activeView === 'memory' && (
            <section className="panel-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Manager</p>
                    <h3>Save New Memory</h3>
                  </div>
                </div>
                <label className="field">
                  <span>Title</span>
                  <input
                    value={manualMemoryTitle}
                    onChange={(event) => setManualMemoryTitle(event.target.value)}
                    placeholder="Example: Preferred low blood sugar summary format"
                  />
                </label>
                <label className="field">
                  <span>Content</span>
                  <textarea
                    value={manualMemoryContent}
                    onChange={(event) => setManualMemoryContent(event.target.value)}
                    rows={8}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Category</span>
                    <select
                      value={manualMemoryCategory}
                      onChange={(event) =>
                        setManualMemoryCategory(event.target.value as MemoryCategory)
                      }
                    >
                      {memoryCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Source</span>
                    <input
                      value={manualMemorySource}
                      onChange={(event) => setManualMemorySource(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <input
                      value={manualMemoryTags}
                      onChange={(event) => setManualMemoryTags(event.target.value)}
                      placeholder="health, workflow, routine"
                    />
                  </label>
                  <label className="field">
                    <span>Importance</span>
                    <select
                      value={manualMemoryImportance}
                      onChange={(event) =>
                        setManualMemoryImportance(event.target.value as MemoryImportance)
                      }
                    >
                      <option value="low">low</option>
                      <option value="normal">normal</option>
                      <option value="important">important</option>
                    </select>
                  </label>
                </div>
                <div className="inline-toggle-row">
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={manualMemoryPinned}
                      onChange={(event) => setManualMemoryPinned(event.target.checked)}
                    />
                    <span>Pin this memory</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={manualMemoryFavorite}
                      onChange={(event) => setManualMemoryFavorite(event.target.checked)}
                    />
                    <span>Mark as favorite</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={manualMemorySafeForLocalAi}
                      onChange={(event) => setManualMemorySafeForLocalAi(event.target.checked)}
                    />
                    <span>Safe for local AI context</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={manualMemoryArchived}
                      onChange={(event) => setManualMemoryArchived(event.target.checked)}
                    />
                    <span>Archive on save</span>
                  </label>
                </div>
                <div className="category-suggestion">
                  <span>Suggested category</span>
                  <strong>{memorySuggestion}</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setManualMemoryCategory(memorySuggestion)}
                  >
                    Apply Suggestion
                  </button>
                </div>
                <div className="button-row button-row--wrap">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSaveManualMemory()}
                  >
                    Save Memory
                  </button>
                  <button type="button" className="danger-button" onClick={() => void handleClearMemory()}>
                    Clear All Memory
                  </button>
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Memory</p>
                    <h3>Search, Group, and Review Local Entries</h3>
                  </div>
                </div>
                <div className="toolbar toolbar--memory">
                  <label className="field">
                    <span>Search memory</span>
                    <input
                      value={memorySearch}
                      onChange={(event) => setMemorySearch(event.target.value)}
                      placeholder="Search title, content, source, or tags"
                    />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select
                      value={memoryFilter}
                      onChange={(event) =>
                        setMemoryFilter(event.target.value as 'all' | MemoryCategory)
                      }
                    >
                      <option value="all">all</option>
                      {memoryCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Sort</span>
                    <select
                      value={memorySortOrder}
                      onChange={(event) =>
                        setMemorySortOrder(event.target.value as MemorySortOrder)
                      }
                    >
                      <option value="newest">newest first</option>
                      <option value="oldest">oldest first</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Tag filter</span>
                    <input
                      value={memoryTagFilter}
                      onChange={(event) => setMemoryTagFilter(event.target.value)}
                      placeholder="workflow, planning"
                    />
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={memoryPinnedOnly}
                      onChange={(event) => setMemoryPinnedOnly(event.target.checked)}
                    />
                    <span>Pinned only</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={memoryArchivedOnly}
                      onChange={(event) => setMemoryArchivedOnly(event.target.checked)}
                    />
                    <span>Archived only</span>
                  </label>
                </div>
                <div className="detail-grid">
                  <article className="mini-card">
                    <span>Total</span>
                    <strong>{appData.memory.length}</strong>
                  </article>
                  <article className="mini-card">
                    <span>Pinned</span>
                    <strong>{appData.memory.filter((entry) => entry.pinned).length}</strong>
                  </article>
                  <article className="mini-card">
                    <span>Archived</span>
                    <strong>{appData.memory.filter((entry) => entry.archived).length}</strong>
                  </article>
                  <article className="mini-card">
                    <span>AI-safe</span>
                    <strong>{appData.memory.filter((entry) => entry.safeForLocalAi).length}</strong>
                  </article>
                </div>
                {memoryCategoryBreakdown.length > 0 && (
                  <p className="field-hint">
                    Category breakdown: {memoryCategoryBreakdown.map(([category, count]) => `${category} (${count})`).join(', ')}
                  </p>
                )}

                <div className="memory-list">
                  {noMemoryYet && (
                    <EmptyState
                      title="No memory saved yet"
                      copy="Save helper outputs or create a manual entry to start building local workflow memory."
                      detail="Pinned items, tags, favorites, and edits will persist automatically."
                    />
                  )}

                  {noFilteredMemory && (
                    <EmptyState
                      title="No memory matches these filters"
                      copy="Try clearing the search text, turning off pinned-only mode, or switching to a different category."
                    />
                  )}

                  {filteredMemory.map((entry) => {
                    const expanded = expandedMemoryIds.includes(entry.id)
                    const duplicates = duplicateMemoryMap.get(entry.id) ?? []
                    const related = relatedMemoryMap.get(entry.id) ?? []

                    return (
                      <article key={entry.id} className="memory-card">
                        <div className="memory-card__top">
                          <div>
                            <div className="memory-title-row">
                              <h4>{entry.title}</h4>
                              <span
                                className={
                                  entry.importance === 'high' || entry.importance === 'important'
                                    ? 'tag tag--accent'
                                    : 'tag'
                                }
                              >
                                {entry.importance}
                              </span>
                              {duplicates.length > 0 && <span className="tag tag--warn">possible duplicate</span>}
                            </div>
                            <div className="memory-tags">
                              <span className="tag">{entry.category}</span>
                              <span className="tag">{entry.source}</span>
                              {entry.pinned && <span className="tag tag--accent">pinned</span>}
                              {entry.favorite && <span className="tag tag--accent">favorite</span>}
                              {entry.safeForLocalAi && <span className="tag tag--accent">ai-safe</span>}
                              {entry.archived && <span className="tag">archived</span>}
                              {entry.tags.map((tag) => (
                                <span key={tag} className="tag">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="memory-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                void updateMemoryEntry(
                                  entry.id,
                                  (current) => ({
                                    ...current,
                                    pinned: !current.pinned,
                                    updatedAt: nowIso(),
                                  }),
                                  entry.pinned ? 'Memory unpinned.' : 'Memory pinned.',
                                  true,
                                )
                              }
                            >
                              {entry.pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                void updateMemoryEntry(
                                  entry.id,
                                  (current) => ({
                                    ...current,
                                    favorite: !current.favorite,
                                    updatedAt: nowIso(),
                                  }),
                                  entry.favorite ? 'Favorite removed.' : 'Marked as favorite.',
                                  true,
                                )
                              }
                            >
                              {entry.favorite ? 'Unfavorite' : 'Favorite'}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                void updateMemoryEntry(
                                  entry.id,
                                  (current) => ({
                                    ...current,
                                    safeForLocalAi: !current.safeForLocalAi,
                                    updatedAt: nowIso(),
                                  }),
                                  entry.safeForLocalAi
                                    ? 'Removed from local AI-safe memory.'
                                    : 'Marked as local AI-safe memory.',
                                  true,
                                )
                              }
                            >
                              {entry.safeForLocalAi ? 'AI-safe off' : 'AI-safe on'}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                void updateMemoryEntry(
                                  entry.id,
                                  (current) => ({
                                    ...current,
                                    archived: !current.archived,
                                    updatedAt: nowIso(),
                                  }),
                                  entry.archived ? 'Memory restored.' : 'Memory archived.',
                                  true,
                                )
                              }
                            >
                              {entry.archived ? 'Restore' : 'Archive'}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => setEditingMemory(createMemoryDraft(entry))}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => toggleExpandedMemory(entry.id)}
                            >
                              {expanded ? 'Collapse' : 'Expand'}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => void handleDeleteMemory(entry.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="memory-card__body">
                          {expanded ? (
                            <>
                              <RichTextBlock text={entry.content} />
                              {related.length > 0 && (
                                <div className="related-memory-box">
                                  <strong>Related memory suggestions</strong>
                                  <ul className="structured-list">
                                    {related.map((item) => (
                                      <li key={item.id}>{item.title}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          ) : (
                            <p>{summarizeText(entry.content)}</p>
                          )}
                        </div>

                        <small>
                          Created {formatDate(entry.createdAt)} | Updated {formatDate(entry.updatedAt)}
                        </small>
                      </article>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {activeView === 'settings' && (
            <section className="panel-grid">
              <div className="panel panel--span-2">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Settings</p>
                    <h3>Persistent Local Preferences</h3>
                  </div>
                </div>
                <div className="settings-callout">
                  <strong>Current runtime</strong>
                  <p>
                    Active provider mode: {activeProviderLabel}. Chat Assistant uses Ollama when
                    ready. Helpers remain rule-based for safety.
                  </p>
                  <p>{fallbackStatusLabel}</p>
                  <p>
                    Storage mode: {storageModeLabel}.
                    {isRemotePcHostStorage
                      ? ' Connected to PC host storage over private network.'
                      : isElectronStorage
                        ? ' Using this PC local file storage.'
                        : " Using this browser's local storage only."}
                  </p>
                </div>
                <div className="settings-callout">
                  <strong>Local AI / Ollama</strong>
                  <p>
                    General Chat Assistant can use Ollama when enabled and a local model is
                    selected. Helpers remain rule-based for safety.
                  </p>
                </div>
                <div className="settings-callout">
                  <strong>Local AI Context</strong>
                  <p>
                    Only selected local context is sent to your local Ollama model.
                  </p>
                  <p>
                    Health Helper and sensitive helpers remain isolated from local AI.
                  </p>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Theme preference</span>
                    <select
                      value={themePreference}
                      onChange={(event) =>
                        setThemePreference(event.target.value as ThemePreference)
                      }
                    >
                      <option value="godzilla">KCx Cyber Blue</option>
                      <option value="midnight">Midnight Utility</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Local AI provider mode</span>
                    <select
                      value={settingsDraft.localAi.providerMode}
                      onChange={(event) =>
                        updateLocalAiDraft((current) => ({
                          ...current,
                          providerMode: event.target.value as AppData['settings']['localAi']['providerMode'],
                        }))
                      }
                    >
                      {providerModeOptions.map((providerId) => {
                        const provider = providerCatalog.find((item) =>
                          providerId === 'ollama' ? item.id === 'ollama' : item.id === 'rule-based',
                        )
                        if (!provider) {
                          return null
                        }
                        return (
                        <option key={providerId} value={providerId}>
                          {provider.name}
                          {providerId === 'rule_based'
                            ? ' (always available)'
                            : ' (local AI)'}
                        </option>
                        )
                      })}
                    </select>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.localAi.ollama.enabled}
                      onChange={(event) =>
                        updateOllamaDraft((current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    <span>Enable Ollama local chat routing</span>
                  </label>
                  <label className="field">
                    <span>Ollama base URL</span>
                    <input
                      value={settingsDraft.localAi.ollama.baseUrl}
                      onChange={(event) =>
                        updateOllamaDraft((current) => ({
                          ...current,
                          baseUrl: event.target.value,
                        }))
                      }
                      placeholder="http://localhost:11434"
                    />
                  </label>
                  <div className="field">
                    <span>Ollama status</span>
                    <p className="field-hint">
                      {settingsDraft.localAi.ollama.lastStatus}: {ollamaStatus.message} Checked{' '}
                      {formatDate(ollamaStatus.checkedAt)}.
                    </p>
                    {ollamaStatus.available &&
                      settingsDraft.localAi.ollama.availableModels.length === 0 && (
                        <p className="field-hint">
                          Ollama is reachable, but no local models were found.
                        </p>
                      )}
                  </div>
                  <label className="field">
                    <span>Selected model</span>
                    <select
                      value={settingsDraft.localAi.ollama.selectedModel}
                      onChange={(event) =>
                        updateOllamaDraft((current) => ({
                          ...current,
                          selectedModel: event.target.value,
                        }))
                      }
                      disabled={
                        !ollamaStatus.available ||
                        settingsDraft.localAi.ollama.availableModels.length === 0
                      }
                    >
                      <option value="">
                        {ollamaStatus.available
                          ? settingsDraft.localAi.ollama.availableModels.length > 0
                            ? 'Select a local model'
                            : 'No local models installed'
                          : 'Ollama unavailable'}
                      </option>
                      {settingsDraft.localAi.ollama.availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Context mode</span>
                    <select
                      value={settingsDraft.localAi.context.contextMode}
                      onChange={(event) =>
                        updateLocalAiContextDraft((current) => ({
                          ...current,
                          contextMode:
                            event.target.value as AppData['settings']['localAi']['context']['contextMode'],
                        }))
                      }
                    >
                      <option value="minimal">minimal</option>
                      <option value="recent_chat_only">recent_chat_only</option>
                      <option value="extended_chat">extended_chat</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Max context messages</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={settingsDraft.localAi.context.maxContextMessages}
                      onChange={(event) =>
                        updateLocalAiContextDraft((current) => ({
                          ...current,
                          maxContextMessages: Math.min(
                            Math.max(Number(event.target.value) || 1, 1),
                            40,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.localAi.context.allowConversationTitles}
                      onChange={(event) =>
                        updateLocalAiContextDraft((current) => ({
                          ...current,
                          allowConversationTitles: event.target.checked,
                        }))
                      }
                    />
                    <span>Include conversation title</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.localAi.context.allowTaskContext}
                      onChange={(event) =>
                        updateLocalAiContextDraft((current) => ({
                          ...current,
                          allowTaskContext: event.target.checked,
                        }))
                      }
                    />
                    <span>Include task titles</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.localAi.context.allowNotesContext}
                      onChange={(event) =>
                        updateLocalAiContextDraft((current) => ({
                          ...current,
                          allowNotesContext: event.target.checked,
                        }))
                      }
                    />
                    <span>Include note titles</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.localAi.context.allowMemoryHighlights}
                      onChange={(event) =>
                        updateLocalAiContextDraft((current) => ({
                          ...current,
                          allowMemoryHighlights: event.target.checked,
                        }))
                      }
                    />
                    <span>Include memory highlights</span>
                  </label>
                </div>
                <div className="button-row button-row--wrap">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      void refreshOllamaStatus(
                        settingsDraft.localAi.ollama.baseUrl,
                        settingsDraft.localAi.ollama.selectedModel,
                        true,
                      )
                    }
                    disabled={testingOllama}
                  >
                    {testingOllama ? 'Checking...' : 'Check Local Connection'}
                  </button>
                  {ollamaSelected && !ollamaStatus.available && (
                    <span className="field-hint">
                      Ollama is not active. Rule-based chat remains available.
                    </span>
                  )}
                  {settingsDraft.localAi.ollama.selectedModel &&
                    !settingsDraft.localAi.ollama.availableModels.includes(
                      settingsDraft.localAi.ollama.selectedModel,
                    ) && (
                      <span className="field-hint">
                        The selected model is no longer available. Rule-based chat is active.
                      </span>
                    )}
                  <span className="field-hint">
                    Ollama runs locally on this PC. KCxModeAI will continue using the
                    rule-based chat assistant if Ollama is not active.
                  </span>
                  {!window.godzillaAPI && (
                    <span className="field-hint">
                      Local AI checks are available in the desktop app. Browser mode stays fully usable.
                    </span>
                  )}
                </div>
                <div className="settings-callout">
                  <strong>Ollama Troubleshooting</strong>
                  <ul className="detail-list detail-list--dense">
                    <li>Install Ollama if it is missing.</li>
                    <li>Start Ollama on this PC.</li>
                    <li>Pull at least one local model.</li>
                    <li>Keep base URL as http://localhost:11434 unless intentionally changed.</li>
                    <li>KCxModeAI falls back to rule-based mode automatically.</li>
                  </ul>
                </div>
                <div className="settings-callout">
                  <strong>Context Preview</strong>
                  <ul className="detail-list detail-list--dense">
                    <li>Context mode: {contextPreview.contextMode}</li>
                    <li>Estimated messages included: {contextPreview.estimatedMessagesIncluded}</li>
                    <li>Tasks included: {contextPreview.tasksIncluded ? 'yes' : 'no'}</li>
                    <li>Notes included: {contextPreview.notesIncluded ? 'yes' : 'no'}</li>
                    <li>Memory highlights included: {contextPreview.memoryHighlightsIncluded ? 'yes' : 'no'}</li>
                    <li>Health data included: {contextPreview.healthDataIncluded}</li>
                  </ul>
                </div>
                <div className="settings-grid">
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={sidebarCollapsed}
                      onChange={(event) => setSidebarCollapsed(event.target.checked)}
                    />
                    <span>Remember sidebar collapsed state</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.notesRememberDrafts}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          notesRememberDrafts: event.target.checked,
                        })
                      }
                    />
                    <span>Persist notes workflow drafts</span>
                  </label>
                  <label className="field">
                    <span>Default focus preset</span>
                    <select
                      value={focusPreset}
                      onChange={(event) =>
                        setFocusPreset(
                          event.target.value as AppData['settings']['helperPreferences']['focusPreset'],
                        )
                      }
                    >
                      <option value="quick_reset">quick_reset</option>
                      <option value="deep_work">deep_work</option>
                      <option value="reentry">reentry</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Default family template</span>
                    <select
                      value={familyTemplate}
                      onChange={(event) =>
                        setFamilyTemplate(
                          event.target.value as AppData['settings']['helperPreferences']['familyTemplate'],
                        )
                      }
                    >
                      <option value="calm_boundary">calm_boundary</option>
                      <option value="routine_reset">routine_reset</option>
                      <option value="screen_time">screen_time</option>
                    </select>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={seniorEasyMode}
                      onChange={(event) => setSeniorEasyMode(event.target.checked)}
                    />
                    <span>Senior easy mode by default</span>
                  </label>
                </div>
                <div className="button-row button-row--wrap">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSaveSettings()}
                  >
                    Save Settings
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void exportFullBackup()}
                  >
                    Export Backup
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => importInputRef.current?.click()}
                  >
                    Import Data
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleOpenDataFolder()}
                  >
                    Open Data Folder
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void exportLocalBundle('workflows')}>
                    Export Workflows
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void exportLocalBundle('safe_memory')}>
                    Export AI-safe Memory
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void exportLocalBundle('settings')}>
                    Export Settings
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void exportLocalBundle('notes_tasks')}>
                    Export Notes/Tasks
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void exportTesterBundle()}>
                    Export Tester Bundle
                  </button>
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden-input"
                  onChange={handleImportFile}
                />
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Privacy & Security</p>
                    <h3>Local-First Security Prep</h3>
                  </div>
                </div>
                <div className="settings-grid">
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.security.partitioning.localAiSafeOnlyVisibility}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          security: {
                            ...settingsDraft.security,
                            partitioning: {
                              ...settingsDraft.security.partitioning,
                              localAiSafeOnlyVisibility: event.target.checked,
                            },
                          },
                        })
                      }
                    />
                    <span>Show only AI-safe memories in Memory Manager</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.security.partitioning.exportSafeOnlyVisibility}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          security: {
                            ...settingsDraft.security,
                            partitioning: {
                              ...settingsDraft.security.partitioning,
                              exportSafeOnlyVisibility: event.target.checked,
                            },
                          },
                        })
                      }
                    />
                    <span>Show only export-safe memory entries</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.security.partitioning.syncEligibleOnlyVisibility}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          security: {
                            ...settingsDraft.security,
                            partitioning: {
                              ...settingsDraft.security.partitioning,
                              syncEligibleOnlyVisibility: event.target.checked,
                            },
                          },
                        })
                      }
                    />
                    <span>Show only sync-eligible memory entries</span>
                  </label>
                  <article className="settings-callout">
                    <strong>Encryption Prep (Future-safe)</strong>
                    <ul className="detail-list detail-list--dense">
                      <li>Encrypted local exports: {settingsDraft.security.encryptionPrep.encryptedLocalExportPlanned ? 'planned' : 'off'}</li>
                      <li>Encrypted sync payloads: {settingsDraft.security.encryptionPrep.encryptedSyncPayloadPlanned ? 'planned' : 'off'}</li>
                      <li>Encrypted memory categories: {settingsDraft.security.encryptionPrep.encryptedMemoryCategoriesPlanned ? 'planned' : 'off'}</li>
                      <li>Secure local pairing prep: {settingsDraft.security.encryptionPrep.securePairingPlanned ? 'planned' : 'off'}</li>
                    </ul>
                    <p className="field-hint">
                      No cloud encryption service or account system is enabled in this phase.
                    </p>
                  </article>
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Tester Tools</p>
                    <h3>Tester Diagnostics and Local Feedback</h3>
                  </div>
                </div>
                <div className="settings-grid">
                  <label className="field field--full">
                    <span>Tester notes (local draft)</span>
                    <textarea
                      rows={3}
                      value={settingsDraft.tester.feedback.testerNotes}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          tester: {
                            ...settingsDraft.tester,
                            feedback: {
                              ...settingsDraft.tester.feedback,
                              testerNotes: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field field--full">
                    <span>Bug report draft (local only)</span>
                    <textarea
                      rows={3}
                      value={settingsDraft.tester.feedback.bugReportDraft}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          tester: {
                            ...settingsDraft.tester,
                            feedback: {
                              ...settingsDraft.tester.feedback,
                              bugReportDraft: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <div className="button-row">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setSettingsDraft({
                          ...settingsDraft,
                          tester: {
                            ...settingsDraft.tester,
                            feedback: {
                              ...settingsDraft.tester.feedback,
                              localFeedbackQueue: [
                                ...settingsDraft.tester.feedback.localFeedbackQueue,
                                settingsDraft.tester.feedback.bugReportDraft.trim() || 'Feedback note',
                              ].slice(-30),
                            },
                          },
                        })
                      }
                    >
                        Add to Local Feedback Queue
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setSettingsDraft({
                          ...settingsDraft,
                          tester: {
                            ...settingsDraft.tester,
                            feedback: {
                              ...settingsDraft.tester.feedback,
                              localFeedbackQueue: [],
                            },
                          },
                        })
                      }
                    >
                      Clear Feedback Queue
                    </button>
                  </div>
                  <div className="button-row">
                    <button type="button" className="ghost-button" onClick={runWorkflowResetPreview}>
                      Workflow Reset Preview
                    </button>
                    <button type="button" className="ghost-button" onClick={runSafeCacheClearPreview}>
                      Safe Cache Clear Preview
                    </button>
                    <button type="button" className="ghost-button" onClick={runImportExportValidationCheck}>
                      Import/Export Validation Check
                    </button>
                  </div>
                  <article className="settings-callout">
                    <strong>Local Tester Queue ({settingsDraft.tester.feedback.localFeedbackQueue.length})</strong>
                    <p className="field-hint">
                      Local drafts only. No telemetry upload and no cloud bug submission is active.
                    </p>
                  </article>
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Onboarding & Accessibility</p>
                    <h3>Quick Start and Readability</h3>
                  </div>
                </div>
                <div className="settings-grid">
                  <article className="settings-callout">
                    <strong>Quick Start</strong>
                    <ul className="detail-list detail-list--dense">
                      <li>1) Start with Notes Helper to capture tasks and reminders.</li>
                      <li>2) Use Chat Assistant for local planning support.</li>
                      <li>3) Open Memory Manager to keep important local context.</li>
                      <li>4) Export local backups regularly for recovery safety.</li>
                    </ul>
                  </article>
                  <article className="settings-callout">
                    <strong>Privacy-first guidance</strong>
                    <p>
                      KCxModeAI is local-first, offline-capable, and does not require a cloud account.
                      Local AI is optional and helper isolation remains strict.
                    </p>
                  </article>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.accessibility.largerText}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          accessibility: {
                            ...settingsDraft.accessibility,
                            largerText: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Larger text support prep</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.accessibility.higherContrast}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          accessibility: {
                            ...settingsDraft.accessibility,
                            higherContrast: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Higher contrast tuning prep</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.accessibility.keyboardNavigationPrep}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          accessibility: {
                            ...settingsDraft.accessibility,
                            keyboardNavigationPrep: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Keyboard navigation prep enabled</span>
                  </label>
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.accessibility.simplifiedWording}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          accessibility: {
                            ...settingsDraft.accessibility,
                            simplifiedWording: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Simplified wording mode</span>
                  </label>
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Android Ecosystem</p>
                    <h3>KCxMode Ecosystem Status</h3>
                  </div>
                </div>
                <div className="settings-grid">
                  <article className="settings-callout">
                    <strong>Ecosystem readiness</strong>
                    <ul className="detail-list detail-list--dense">
                      <li>Shared workflow sync prep: {settingsDraft.androidEcosystem.sharedWorkflowSyncPrep ? 'ready' : 'off'}</li>
                      <li>Shared notes/tasks summaries: {settingsDraft.androidEcosystem.sharedNotesTasksSummaryPrep ? 'ready' : 'off'}</li>
                      <li>Shared focus session prep: {settingsDraft.androidEcosystem.sharedFocusSessionsPrep ? 'ready' : 'off'}</li>
                      <li>Family/Senior summary sync prep: {settingsDraft.androidEcosystem.sharedFamilySeniorSummaryPrep ? 'ready' : 'off'}</li>
                      <li>AI-safe memory preview prep: {settingsDraft.androidEcosystem.aiSafeMemorySyncPreviewPrep ? 'ready' : 'off'}</li>
                    </ul>
                  </article>
                  <article className="settings-callout">
                    <strong>Local-only ecosystem message</strong>
                    <p>
                      Ecosystem communication remains local-first and offline-capable. No public API
                      endpoints or cloud account requirements are introduced.
                    </p>
                  </article>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">App Info</p>
                    <h3>Release Readiness</h3>
                  </div>
                </div>
                <ul className="detail-list detail-list--dense">
                  <li>App: {appInfo.appName}</li>
                  <li>Version: {appInfo.appVersion}</li>
                  <li>Electron: {appInfo.electronVersion}</li>
                  <li>Chrome: {appInfo.chromeVersion}</li>
                  <li>Node: {appInfo.nodeVersion}</li>
                  <li>Build channel: {appInfo.buildChannel}</li>
                  <li>Release type: {appInfo.releaseType}</li>
                  <li>Environment status: {appInfo.environmentStatus}</li>
                  <li>Packaging target: {appInfo.packagingTarget}</li>
                  <li>Build metadata: {appInfo.buildCommit}</li>
                  <li>Packaged: {appInfo.isPackaged ? 'yes' : 'no'}</li>
                  <li>Data file: {appInfo.dataFilePath}</li>
                  <li>Data folder: {appInfo.dataDirectoryPath}</li>
                  <li>Runtime mode: {window.godzillaAPI ? 'desktop app' : 'browser fallback'}</li>
                  <li>Remembered last screen: {activeView}</li>
                  <li>
                    Preferred provider: {selectedProvider?.name ?? 'Rule-Based Provider'} (
                    {settingsDraft.localAi.providerMode === 'ollama'
                      ? ollamaStatus.available
                        ? 'local Ollama ready (chat assistant only)'
                        : 'rule-based fallback active'
                      : 'local-only active provider'}
                    )
                  </li>
                  <li>Android bridge: {settingsDraft.androidBridge.enabled ? 'prepared for future local sync' : 'not active yet'}</li>
                </ul>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Notifications</p>
                    <h3>Local Reminders</h3>
                  </div>
                  <button type="button" className="ghost-button" onClick={addReminder}>
                    Add Reminder
                  </button>
                </div>
                <div className="settings-grid">
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.notifications.enabled}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          notifications: {
                            ...settingsDraft.notifications,
                            enabled: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Enable local reminder scheduling prep</span>
                  </label>
                  <div className="field">
                    <span>Next reminder</span>
                    <p className="field-hint">
                      {nextReminder?.nextReminderAt
                        ? formatDate(nextReminder.nextReminderAt)
                        : 'No reminder scheduled.'}
                    </p>
                  </div>
                  {!window.godzillaAPI && (
                    <div className="field">
                      <span>Browser fallback</span>
                      <p className="field-hint">
                        Desktop notification delivery is disabled in browser mode.
                      </p>
                      <button type="button" className="ghost-button" onClick={() => void requestBrowserNotificationPermission()}>
                        Request Browser Permission
                      </button>
                    </div>
                  )}
                </div>
                <div className="task-list">
                  {settingsDraft.notifications.reminders.length === 0 && (
                    <EmptyState
                      title="No reminders yet"
                      copy="Create local reminders for workflows, tasks, focus, or notes review."
                      detail="Reminder scheduling is a local-only preview and does not require cloud services."
                    />
                  )}
                  {settingsDraft.notifications.reminders.map((reminder) => (
                    <div key={reminder.id} className="task-row">
                      <div className="task-row__main">
                        <label className="checklist-toggle">
                          <input
                            type="checkbox"
                            checked={reminder.enabled}
                            onChange={(event) => updateReminder(reminder.id, { enabled: event.target.checked })}
                          />
                        </label>
                        <input
                          value={reminder.title}
                          onChange={(event) => updateReminder(reminder.id, { title: event.target.value })}
                        />
                      </div>
                      <div className="task-row__meta">
                        <select
                          value={reminder.type}
                          onChange={(event) => updateReminder(reminder.id, { type: event.target.value as ReminderItem['type'] })}
                        >
                          <option value="workflow">workflow</option>
                          <option value="task">task</option>
                          <option value="focus">focus</option>
                          <option value="notes_review">notes_review</option>
                        </select>
                        <input
                          type="datetime-local"
                          value={reminder.remindAt.slice(0, 16)}
                          onChange={(event) =>
                            updateReminder(
                              reminder.id,
                              event.target.value
                                ? {
                                    remindAt: new Date(event.target.value).toISOString(),
                                    nextReminderAt: new Date(event.target.value).toISOString(),
                                  }
                                : {
                                    remindAt: reminder.remindAt,
                                  },
                            )
                          }
                        />
                        <button type="button" className="ghost-button" onClick={() => removeReminder(reminder.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Network</p>
                    <h3>Connection Status</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      void refreshNetworkStatus(true)
                      void refreshPrivateBrowserAccessStatus(false)
                    }}
                  >
                    Refresh Status
                  </button>
                </div>
                <div className="settings-grid">
                  <article className="settings-callout">
                    <strong>Localhost status</strong>
                    <p>{networkStatus.localhostStatus === 'online' ? 'Online' : 'Offline'}</p>
                  </article>
                  <article className="settings-callout">
                    <strong>Browser access enabled</strong>
                    <p>{settingsDraft.remoteAccess.browserAccessEnabled ? 'Yes (private-network only)' : 'No'}</p>
                  </article>
                  <article className="settings-callout">
                    <strong>Current browser host mode</strong>
                    <p>{browserHostModeLabel}</p>
                  </article>
                  <article className="settings-callout">
                    <strong>Current browser port</strong>
                    <p>{settingsDraft.remoteAccess.browserPort}</p>
                  </article>
                  <article className="settings-callout">
                    <strong>Local network IP</strong>
                    <p>{networkStatus.localNetworkIp ?? 'Not detected'}</p>
                  </article>
                  <article className="settings-callout">
                    <strong>Tailscale detected</strong>
                    <p>{networkStatus.tailscaleDetected ? 'Yes' : 'No'}</p>
                  </article>
                  <article className="settings-callout">
                    <strong>Tailscale IP</strong>
                    <p>{networkStatus.tailscaleIp ?? 'Not available'}</p>
                  </article>
                </div>
                {settingsDraft.remoteAccess.browserAccessEnabled && (
                  <div className="settings-callout remote-access-warning">
                    <strong>Remote browser access is enabled</strong>
                    <p>
                      Private-network access only. No public cloud hosting active and no public internet API is exposed by default.
                    </p>
                    <p>
                      Use Tailscale or your local network for remote access while this PC stays on and connected.
                    </p>
                    {remoteBrowserUrl && (
                      <p className="network-readiness-copy">Current private URL: {remoteBrowserUrl}</p>
                    )}
                  </div>
                )}
                <div className="settings-callout network-readiness-box">
                  <strong>Remote access readiness</strong>
                  <p>{networkReadinessLabel}</p>
                  <p className="network-readiness-copy">
                    Remote client mode: {bridgeClientMode}. Host storage:{' '}
                    {isRemotePcHostStorage ? 'available' : 'unavailable'}.
                  </p>
                  <p className="network-readiness-copy">
                    LAN accessible: {lanAccessible ? 'Yes' : 'No'} | Tailscale accessible: {tailscaleAccessible ? 'Yes' : 'No'}
                  </p>
                  <p className="network-readiness-copy">
                    Checked {formatDate(networkStatus.checkedAt)}.
                  </p>
                  {networkStatus.notes.length > 0 && (
                    <ul className="detail-list detail-list--dense">
                      {networkStatus.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="settings-callout network-readiness-box">
                  <strong>Private browser access runtime</strong>
                  <p>Status: {privateBrowserAccessStatusLabel}</p>
                  <p className="network-readiness-copy">{privateBrowserAccessStatus.message}</p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleStartPrivateBrowserAccess()}
                      disabled={
                        !settingsDraft.remoteAccess.browserAccessEnabled ||
                        privateBrowserAccessStatus.status === 'starting'
                      }
                    >
                      Start Private Browser Access
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleStopPrivateBrowserAccess()}
                      disabled={privateBrowserAccessStatus.status !== 'running'}
                    >
                      Stop Private Browser Access
                    </button>
                  </div>
                  {!settingsDraft.remoteAccess.browserAccessEnabled && (
                    <p className="field-hint">
                      Enable private-network browser access first to allow starting the local host server.
                    </p>
                  )}
                  {(privateBrowserAccessStatus.localhostUrl ||
                    privateBrowserAccessStatus.lanUrl ||
                    privateBrowserAccessStatus.tailscaleUrl) && (
                    <ul className="detail-list detail-list--dense">
                      <li>localhost: {privateBrowserAccessStatus.localhostUrl ?? 'not active'}</li>
                      <li>LAN: {privateBrowserAccessStatus.lanUrl ?? 'not available'}</li>
                      <li>Tailscale: {privateBrowserAccessStatus.tailscaleUrl ?? 'not available'}</li>
                    </ul>
                  )}
                </div>
                {privateBrowserAccessStatus.status === 'running' && (
                  <div className="settings-callout remote-access-warning">
                    <strong>Private browser access is running on this PC.</strong>
                    <p>
                      Only use this on trusted private networks such as your home LAN or Tailscale.
                    </p>
                  </div>
                )}
                <div className="settings-grid">
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.remoteAccess.browserAccessEnabled}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          remoteAccess: {
                            ...settingsDraft.remoteAccess,
                            browserAccessEnabled: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Enable private-network browser access</span>
                  </label>
                  <label className="field">
                    <span>Browser host mode</span>
                    <select
                      value={settingsDraft.remoteAccess.browserHostMode}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          remoteAccess: {
                            ...settingsDraft.remoteAccess,
                            browserHostMode: event.target.value as typeof settingsDraft.remoteAccess.browserHostMode,
                            browserBindHost:
                              event.target.value === 'lan' || event.target.value === 'tailscale'
                                ? '0.0.0.0'
                                : '127.0.0.1',
                          },
                        })
                      }
                    >
                      <option value="localhost_only">localhost only (default)</option>
                      <option value="lan">LAN private IP</option>
                      <option value="tailscale">Tailscale private IP</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Browser bind host</span>
                    <input
                      value={settingsDraft.remoteAccess.browserBindHost}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          remoteAccess: {
                            ...settingsDraft.remoteAccess,
                            browserBindHost: event.target.value.trim() || '127.0.0.1',
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Browser access port</span>
                    <input
                      type="number"
                      min={1024}
                      max={65535}
                      value={settingsDraft.remoteAccess.browserPort}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          remoteAccess: {
                            ...settingsDraft.remoteAccess,
                            browserPort: (() => {
                              const parsed = Number(event.target.value)
                              return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535
                                ? Math.round(parsed)
                                : 4173
                            })(),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Local access PIN (placeholder)</span>
                    <input
                      type="password"
                      value={settingsDraft.remoteAccess.localAccessPin}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          remoteAccess: {
                            ...settingsDraft.remoteAccess,
                            localAccessPin: event.target.value,
                          },
                        })
                      }
                      placeholder="Optional future local PIN"
                    />
                    <p className="field-hint">
                      Placeholder only for future lightweight protection. No account system is active.
                    </p>
                  </label>
                  <label className="field">
                    <span>Trusted network label (placeholder)</span>
                    <input
                      value={settingsDraft.remoteAccess.trustedNetworkLabel}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          remoteAccess: {
                            ...settingsDraft.remoteAccess,
                            trustedNetworkLabel: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Network Help</p>
                    <h3>Local and Remote Access Basics</h3>
                  </div>
                </div>
                <div className="settings-grid">
                  <article className="settings-callout">
                    <strong>Local network access</strong>
                    <p>
                      This app runs on your PC first. Local tools continue to work even when no
                      remote link is configured.
                    </p>
                  </article>
                  <article className="settings-callout">
                    <strong>Same-WiFi access</strong>
                    <p>
                      Devices on the same Wi-Fi can only connect in future phases if a secure
                      bridge is explicitly enabled.
                    </p>
                  </article>
                  <article className="settings-callout">
                    <strong>Tailscale remote access</strong>
                    <p>
                      Tailscale can provide private device-to-device connectivity without exposing
                      public internet ports.
                    </p>
                  </article>
                  <article className="settings-callout">
                    <strong>Private-network access only</strong>
                    <p>
                      No public cloud hosting is active. Use Tailscale or local network routes for remote browser access.
                    </p>
                  </article>
                  <article className="settings-callout">
                    <strong>PC availability</strong>
                    <p>
                      Remote access still depends on this PC staying powered on, awake, and
                      connected.
                    </p>
                  </article>
                </div>
              </div>

              <div className="panel panel--span-3">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Android Bridge</p>
                    <h3>KCxMode Android Bridge</h3>
                  </div>
                </div>
                <div className="settings-callout">
                  <strong>Status: {bridgeStatusLabel}</strong>
                  <p>
                    Prepared for future local sync with the KCxMode Android ecosystem.
                  </p>
                  <p>
                    Private browser access can now share the PC app data with remote browser clients.
                  </p>
                  <p>
                    Remote client storage bridge: {bridgeClientMode}. Last bridge check:{' '}
                    {formatDate(networkStatus.checkedAt)}.
                  </p>
                  <p>
                    Bridge traffic is local-only or Tailscale-only by design. Cloud sync is not active.
                  </p>
                  <p>
                    Local-only preview: secure pairing, local sync, and encrypted payload prep are coming later.
                  </p>
                </div>
                <div className="settings-grid">
                  <label className="toggle-row toggle-row--panel">
                    <input
                      type="checkbox"
                      checked={settingsDraft.androidBridge.enabled}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          androidBridge: {
                            ...settingsDraft.androidBridge,
                            enabled: event.target.checked,
                            bridgeMode: event.target.checked
                              ? settingsDraft.androidBridge.bridgeMode === 'off'
                                ? 'local_only'
                                : settingsDraft.androidBridge.bridgeMode
                              : 'off',
                          },
                        })
                      }
                    />
                    <span>Enable Android bridge preview</span>
                  </label>
                  <label className="field">
                    <span>Bridge mode</span>
                    <select
                      value={settingsDraft.androidBridge.bridgeMode}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          androidBridge: {
                            ...settingsDraft.androidBridge,
                            bridgeMode: event.target.value as AndroidBridgeSettings['bridgeMode'],
                            enabled: event.target.value !== 'off',
                          },
                        })
                      }
                    >
                      {bridgeModeOptions.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Local bridge port (prepared for future local sync)</span>
                    <input
                      type="number"
                      min={1024}
                      max={65535}
                      value={settingsDraft.androidBridge.localBridgePort}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          androidBridge: {
                            ...settingsDraft.androidBridge,
                            localBridgePort: Number(event.target.value) || 43117,
                          },
                        })
                      }
                    />
                  </label>
                  <div className="field">
                    <span>Pairing code</span>
                    <p className="field-hint">
                      {settingsDraft.androidBridge.pairingCode || 'Not active yet.'}
                    </p>
                  </div>
                  <label className="field">
                    <span>Pairing note</span>
                    <input
                      value={settingsDraft.androidBridge.syncPairingPlaceholder}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          androidBridge: {
                            ...settingsDraft.androidBridge,
                            syncPairingPlaceholder: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <div className="field">
                    <span>Allowed devices</span>
                    <p className="field-hint">
                      {settingsDraft.androidBridge.allowedDevices.length > 0
                        ? settingsDraft.androidBridge.allowedDevices
                            .map((device) => device.label)
                            .join(', ')
                        : 'No allowed devices added yet.'}
                    </p>
                  </div>
                  <div className="field">
                    <span>Paired devices</span>
                    <p className="field-hint">
                      {settingsDraft.androidBridge.pairedDevices.length > 0
                        ? settingsDraft.androidBridge.pairedDevices
                            .map((device) => device.label)
                            .join(', ')
                        : 'No paired devices yet. Pairing is prepared for future local sync.'}
                    </p>
                  </div>
                  <div className="field">
                    <span>Last sync preview check</span>
                    <p className="field-hint">
                      {settingsDraft.androidBridge.syncPreviewLastCheckedAt
                        ? formatDate(settingsDraft.androidBridge.syncPreviewLastCheckedAt)
                        : 'Not checked yet'}
                    </p>
                  </div>
                </div>
                <div className="settings-callout">
                  <strong>Android Sync Preview</strong>
                  <ul className="detail-list detail-list--dense">
                    {androidSyncPreviewCategories.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <ul className="detail-list detail-list--dense">
                    <li>Notes eligible: {syncPreviewStats.notes}</li>
                    <li>Tasks eligible: {syncPreviewStats.tasks}</li>
                    <li>Workflow routines eligible: {syncPreviewStats.workflowRoutines}</li>
                    <li>Memory highlights eligible: {syncPreviewStats.memoryHighlights}</li>
                    <li>Focus routines eligible: {syncPreviewStats.focusRoutines}</li>
                    <li>Family/Senior summaries eligible: {syncPreviewStats.familySeniorSummaries}</li>
                    <li>Sync sessions: {appData.workflows.syncSessions.length}</li>
                    <li>Conflict summaries: {appData.workflows.syncConflicts.length}</li>
                    <li>
                      Bridge status:{' '}
                      {settingsDraft.androidBridge.enabled &&
                      settingsDraft.androidBridge.bridgeMode !== 'off'
                        ? 'prepared for future local sync'
                        : 'not active yet'}
                    </li>
                  </ul>
                  <p className="field-hint">
                    Desktop companion features will still require this PC to be on. Android should
                    keep offline local workflows even when bridge sync is not active.
                  </p>
                  <p className="field-hint">
                    Sync remains local-only preparation. No public ports, cloud sync, or background sync service are active.
                  </p>
                  <div className="button-row">
                    <button type="button" className="ghost-button" onClick={() => void refreshSyncPreviewStatus()}>
                      Refresh Sync Preview
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {editingMemory && (
        <MemoryEditModal
          draft={editingMemory}
          onDraftChange={setEditingMemory}
          onClose={() => setEditingMemory(null)}
          onSave={async () => {
            const draft = editingMemory
            if (!draft.title.trim() || !draft.content.trim()) {
              updateStatus('Memory title and content are required.', 'warning', true)
              return
            }

            await updateMemoryEntry(
              draft.id,
              (current) => ({
                ...current,
                title: draft.title.trim(),
                content: draft.content.trim(),
                category: draft.category,
                source: draft.source.trim() || 'manual_entry',
                tags: parseTags(draft.tags),
                pinned: draft.pinned,
                favorite: draft.favorite,
                importance: draft.importance,
                safeForLocalAi: draft.safeForLocalAi,
                archived: draft.archived,
                updatedAt: nowIso(),
              }),
              'Memory entry updated.',
              true,
            )

            setEditingMemory(null)
          }}
        />
      )}

      {commandPaletteOpen && (
        <ModalShell title="Command Palette" onClose={() => setCommandPaletteOpen(false)}>
          <label className="field">
            <span>Search commands</span>
            <input
              autoFocus
              value={commandPaletteQuery}
              onChange={(event) => setCommandPaletteQuery(event.target.value)}
              placeholder="Type a command"
            />
          </label>
          <div className="modal-result-list">
            {commandPaletteResults.map((action) => (
              <button
                key={action.id}
                type="button"
                className="command-row"
                onClick={() => {
                  action.run()
                  setCommandPaletteOpen(false)
                  setCommandPaletteQuery('')
                }}
              >
                <strong>{action.label}</strong>
                <p>{action.detail}</p>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {globalSearchOpen && (
        <ModalShell title="Global Search" onClose={() => setGlobalSearchOpen(false)}>
          <label className="field">
            <span>Search memory, tasks, notes, and conversations</span>
            <input
              autoFocus
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
              placeholder="Search everything local"
            />
          </label>
          <div className="modal-result-list">
            {globalSearchQuery.trim().length === 0 && (
              <EmptyState
                title="Start typing to search"
                copy="Global search covers memory, tasks, note drafts, and saved conversations."
              />
            )}
            {globalSearchQuery.trim().length > 0 && globalSearchResults.length === 0 && (
              <EmptyState
                title="No matches found"
                copy="Try a broader term or switch to a specific workflow screen."
              />
            )}
            {globalSearchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className="command-row"
                onClick={result.action}
              >
                <strong>{result.title}</strong>
                <p>{result.detail}</p>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {shortcutsOpen && (
        <ModalShell title="Keyboard Shortcuts" onClose={() => setShortcutsOpen(false)}>
          <div className="shortcut-list">
            <ShortcutRow keys="Ctrl+K" detail="Open command palette" />
            <ShortcutRow keys="Ctrl+Shift+F" detail="Open global search" />
            <ShortcutRow keys="?" detail="Open keyboard shortcuts reference" />
            <ShortcutRow keys="Ctrl+Enter" detail="Run the main action in chat and helper textareas" />
            <ShortcutRow keys="Escape" detail="Close the active modal or editor" />
          </div>
        </ModalShell>
      )}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

type EmptyStateProps = {
  title: string
  copy: string
  detail?: string
}

function EmptyState({ title, copy, detail }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      <p>{copy}</p>
      {detail ? <small>{detail}</small> : null}
    </div>
  )
}

type ChecklistEditorProps = {
  title: string
  items: ChecklistItem[]
  onToggle: (id: string) => void
  onChange: (id: string, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}

function ChecklistEditor({
  title,
  items,
  onToggle,
  onChange,
  onRemove,
  onAdd,
}: ChecklistEditorProps) {
  return (
    <div className="checklist-editor">
      <div className="checklist-editor__header">
        <strong>{title}</strong>
        <button type="button" className="ghost-button" onClick={onAdd}>
          Add Item
        </button>
      </div>
      <div className="checklist-list">
        {items.length === 0 && (
          <EmptyState
            title="Nothing here yet"
            copy="Analyze notes or add a manual item to start building this checklist."
          />
        )}
        {items.map((item) => (
          <div key={item.id} className="checklist-row">
            <label className="checklist-toggle">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => onToggle(item.id)}
              />
            </label>
            <input
              value={item.label}
              onChange={(event) => onChange(item.id, event.target.value)}
              placeholder="Item text"
            />
            <button type="button" className="ghost-button" onClick={() => onRemove(item.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

type TaskRowProps = {
  task: TaskItem
  overdue: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<TaskItem>) => void
  onDelete: () => void
}

function TaskRow({ task, overdue, onToggle, onUpdate, onDelete }: TaskRowProps) {
  return (
    <div className={overdue ? 'task-row task-row--overdue' : 'task-row'}>
      <div className="task-row__main">
        <label className="checklist-toggle">
          <input type="checkbox" checked={task.completed} onChange={onToggle} />
        </label>
        <input
          value={task.label}
          onChange={(event) => onUpdate({ label: event.target.value })}
          placeholder="Task description"
        />
      </div>
      <div className="task-row__meta">
        <input
          type="date"
          value={task.dueDate ?? ''}
          onChange={(event) => onUpdate({ dueDate: event.target.value || null })}
        />
        <select
          value={task.priority}
          onChange={(event) => onUpdate({ priority: event.target.value as TaskPriority })}
        >
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
        </select>
        <input
          value={task.category}
          onChange={(event) => onUpdate({ category: event.target.value })}
          placeholder="category"
        />
        <button
          type="button"
          className={task.pinned ? 'ghost-button ghost-button--accent' : 'ghost-button'}
          onClick={() => onUpdate({ pinned: !task.pinned })}
        >
          {task.pinned ? 'Pinned' : 'Pin'}
        </button>
        <button type="button" className="ghost-button" onClick={onDelete}>
          Delete
        </button>
      </div>
      {overdue && <small className="task-overdue-label">Overdue</small>}
    </div>
  )
}

type RichTextBlockProps = {
  text: string
}

function RichTextBlock({ text }: RichTextBlockProps) {
  const lines = text.split(/\r?\n/)

  return (
    <div className="rich-text">
      {lines.map((line, index) => {
        const trimmed = line.trim()

        if (!trimmed) {
          return <div key={`spacer-${index}`} className="rich-text__spacer" />
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h5 key={`heading-${index}`} className="rich-text__heading">
              {trimmed.slice(2)}
            </h5>
          )
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={`bullet-${index}`} className="rich-text__bullet">
              <span>•</span>
              <p>{trimmed.slice(2)}</p>
            </div>
          )
        }

        const checklistMatch = trimmed.match(/^\[(x| )\]\s*(.+)$/i)
        if (checklistMatch) {
          return (
            <div key={`check-${index}`} className="rich-text__bullet">
              <span>{checklistMatch[1].toLowerCase() === 'x' ? '☑' : '☐'}</span>
              <p>{checklistMatch[2]}</p>
            </div>
          )
        }

        return <p key={`paragraph-${index}`}>{trimmed}</p>
      })}
    </div>
  )
}

type ResultCardProps = {
  response: StructuredAiResponse
  onCopy: () => void
  onSave: () => void
  compact?: boolean
}

function ResultCard({ response, onCopy, onSave, compact = false }: ResultCardProps) {
  return (
    <div
      className={
        compact
          ? `result-card result-card--${response.safetyLevel} result-card--compact`
          : `result-card result-card--${response.safetyLevel}`
      }
    >
      <div className="result-card__header">
        <div>
          <span className="result-type">{response.type}</span>
          <h4>{response.title}</h4>
        </div>
        <span className={`safety-badge safety-badge--${response.safetyLevel}`}>
          {safetyTone[response.safetyLevel]}
        </span>
      </div>
      <p className="result-copy">{response.responseText}</p>
      <div className="result-columns">
        <div>
          <strong>Key points</strong>
          <StructuredList items={response.bullets} />
        </div>
        <div>
          <strong>Suggested actions</strong>
          <StructuredList items={response.suggestedActions} />
        </div>
      </div>
      {response.memoryUpdates && response.memoryUpdates.length > 0 && (
        <div className="memory-update-box">
          <strong>Memory-ready highlights</strong>
          <StructuredList items={response.memoryUpdates} />
        </div>
      )}
      <div className="button-row">
        <button type="button" className="ghost-button" onClick={onCopy}>
          Copy Response
        </button>
        <button type="button" className="primary-button" onClick={onSave}>
          Save Response to Memory
        </button>
      </div>
    </div>
  )
}

type StructuredListProps = {
  items: string[]
}

function StructuredList({ items }: StructuredListProps) {
  return (
    <ul className="structured-list">
      {items.map((item) => {
        const divider = item.indexOf(':')
        const hasLabel = divider > 0 && divider < 28

        return (
          <li key={item}>
            {hasLabel ? (
              <>
                <strong>{item.slice(0, divider)}:</strong> {item.slice(divider + 1).trim()}
              </>
            ) : (
              item
            )}
          </li>
        )
      })}
    </ul>
  )
}

type MemoryEditModalProps = {
  draft: MemoryDraft
  onDraftChange: (draft: MemoryDraft) => void
  onClose: () => void
  onSave: () => void
}

function MemoryEditModal({
  draft,
  onDraftChange,
  onClose,
  onSave,
}: MemoryEditModalProps) {
  return (
    <ModalShell title="Edit Local Memory" onClose={onClose}>
      <div className="modal-grid">
        <label className="field">
          <span>Title</span>
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={draft.category}
            onChange={(event) =>
              onDraftChange({ ...draft, category: event.target.value as MemoryCategory })
            }
          >
            {memoryCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Source</span>
          <input
            value={draft.source}
            onChange={(event) => onDraftChange({ ...draft, source: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Tags</span>
          <input
            value={draft.tags}
            onChange={(event) => onDraftChange({ ...draft, tags: event.target.value })}
            placeholder="comma,separated,tags"
          />
        </label>
        <label className="field field--full">
          <span>Content</span>
          <textarea
            value={draft.content}
            onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
            rows={10}
          />
        </label>
        <label className="field">
          <span>Importance</span>
          <select
            value={draft.importance}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                importance: event.target.value as MemoryImportance,
              })
            }
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="important">important</option>
          </select>
        </label>
      </div>
      <div className="inline-toggle-row">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={draft.pinned}
            onChange={(event) => onDraftChange({ ...draft, pinned: event.target.checked })}
          />
          <span>Pinned</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={draft.favorite}
            onChange={(event) => onDraftChange({ ...draft, favorite: event.target.checked })}
          />
          <span>Favorite</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={draft.safeForLocalAi}
            onChange={(event) => onDraftChange({ ...draft, safeForLocalAi: event.target.checked })}
          />
          <span>Safe for local AI</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={draft.archived}
            onChange={(event) => onDraftChange({ ...draft, archived: event.target.checked })}
          />
          <span>Archived</span>
        </label>
      </div>
      <div className="button-row button-row--wrap">
        <button type="button" className="primary-button" onClick={onSave}>
          Save Changes
        </button>
        <button type="button" className="ghost-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </ModalShell>
  )
}

type ModalShellProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function ModalShell({ title, onClose, children }: ModalShellProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Modal</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

type ShortcutRowProps = {
  keys: string
  detail: string
}

function ShortcutRow({ keys, detail }: ShortcutRowProps) {
  return (
    <div className="shortcut-row">
      <strong>{keys}</strong>
      <p>{detail}</p>
    </div>
  )
}

export default App
