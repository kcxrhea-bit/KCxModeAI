import type { AppData, Conversation, LocalAiContextSettings } from '../types'

export type LocalAiContextSummary = {
  contextMode: LocalAiContextSettings['contextMode']
  estimatedMessagesIncluded: number
  tasksIncluded: boolean
  notesIncluded: boolean
  memoryHighlightsIncluded: boolean
  healthDataIncluded: 'never'
}

type BuildContextInput = {
  appData: AppData
  conversation: Conversation | null
  input: string
}

const blockedResponseTypes = new Set([
  'health_summary',
  'blood_sugar',
  'a1c',
  'medicine_log',
  'symptom_note',
  'doctor_report',
  'focus_support',
  'family_support',
  'senior_support',
  'messy_notes',
  'shopping_text',
  'todo_text',
])

const looksSensitiveHealthContent = (value: string) =>
  /blood sugar|glucose|a1c|mg\/d?l|medicine|medication|symptom|doctor note|insulin/i.test(
    value,
  )

const cleanLine = (value: string, maxLen = 220) => {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 3).trim()}...` : trimmed
}

const clampMessageCount = (value: number) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 40) : 6

// Health-related content must not be routed to Ollama without a future health-safe AI wrapper phase.
// Sensitive helper systems intentionally remain isolated from local AI routing.
export const buildSafeLocalAiContext = ({
  appData,
  conversation,
  input,
}: BuildContextInput): { prompt: string; summary: LocalAiContextSummary } => {
  const settings = appData.settings.localAi.context
  const maxMessages = clampMessageCount(settings.maxContextMessages)
  const mode = settings.contextMode

  const summary: LocalAiContextSummary = {
    contextMode: mode,
    estimatedMessagesIncluded: 0,
    tasksIncluded: false,
    notesIncluded: false,
    memoryHighlightsIncluded: false,
    healthDataIncluded: 'never',
  }

  if (mode === 'minimal' || !conversation) {
    return { prompt: input, summary }
  }

  const sourceMessages = [...conversation.messages]
    .filter((message) => {
      if (message.response?.type && blockedResponseTypes.has(message.response.type)) {
        return false
      }
      return !looksSensitiveHealthContent(message.content)
    })
    .slice(-maxMessages)

  summary.estimatedMessagesIncluded = sourceMessages.length

  const promptParts: string[] = []
  if (settings.allowConversationTitles && conversation.title.trim()) {
    promptParts.push(`Conversation title: ${cleanLine(conversation.title, 80)}`)
  }

  if (sourceMessages.length > 0) {
    promptParts.push('Recent chat context:')
    for (const message of sourceMessages) {
      const role = message.role === 'assistant' ? 'Assistant' : 'User'
      promptParts.push(`- ${role}: ${cleanLine(message.content)}`)
    }
  }

  if (settings.allowTaskContext) {
    const taskTitles = appData.workflows.notes.taskItems
      .filter((task) => !looksSensitiveHealthContent(task.label))
      .slice(0, 5)
      .map((task) => cleanLine(task.label, 100))
    if (taskTitles.length > 0) {
      summary.tasksIncluded = true
      promptParts.push(`Task titles: ${taskTitles.join(' | ')}`)
    }
  }

  if (settings.allowNotesContext) {
    const noteTitles = appData.memory
      .filter(
        (entry) =>
          !entry.archived &&
          entry.safeForLocalAi &&
          (entry.category === 'note' ||
            entry.category === 'reminder' ||
            entry.category === 'safe_note') &&
          !looksSensitiveHealthContent(`${entry.title} ${entry.content}`),
      )
      .slice(0, 5)
      .map((entry) => cleanLine(entry.title, 100))
    if (noteTitles.length > 0) {
      summary.notesIncluded = true
      promptParts.push(`Note titles: ${noteTitles.join(' | ')}`)
    }
  }

  if (settings.allowMemoryHighlights) {
    const memoryHighlights = appData.memory
      .filter(
        (entry) =>
          !entry.archived &&
          entry.safeForLocalAi &&
          (entry.pinned ||
            entry.favorite ||
            entry.importance === 'high' ||
            entry.importance === 'important') &&
          !looksSensitiveHealthContent(`${entry.title} ${entry.content}`),
      )
      .slice(0, 5)
      .map((entry) => cleanLine(entry.title, 100))
    if (memoryHighlights.length > 0) {
      summary.memoryHighlightsIncluded = true
      promptParts.push(`Memory highlights: ${memoryHighlights.join(' | ')}`)
    }
  }

  const finalPrompt =
    promptParts.length > 0
      ? [...promptParts, '', `Current user message: ${cleanLine(input, 500)}`].join('\n')
      : input

  return { prompt: finalPrompt, summary }
}
