import type { LocalAiSettings, OllamaStatus, ProviderId } from '../types'

export type LocalAiRoutingState = {
  selectedMode: LocalAiSettings['providerMode']
  providerForRuntime: ProviderId
  fallbackActive: boolean
  note: string
}

export type ChatOllamaGuardResult = {
  allowed: boolean
  reason: string
}

const normalizeModelAlias = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  return trimmed.endsWith(':latest') ? trimmed.slice(0, -7) : trimmed
}

export const isSelectedOllamaModelAvailable = (
  selectedModel: string,
  availableModels: string[],
) => {
  const normalizedSelected = normalizeModelAlias(selectedModel)
  if (!normalizedSelected) {
    return false
  }
  return availableModels.some((model) => normalizeModelAlias(model) === normalizedSelected)
}

export const resolveLocalAiRoutingState = (
  localAi: LocalAiSettings,
  ollamaStatus: OllamaStatus,
): LocalAiRoutingState => {
  if (localAi.providerMode !== 'ollama') {
    return {
      selectedMode: 'rule_based',
      providerForRuntime: 'rule-based',
      fallbackActive: false,
      note: 'Rule-based provider selected.',
    }
  }

  if (!localAi.ollama.enabled || !ollamaStatus.available) {
    return {
      selectedMode: 'ollama',
      providerForRuntime: 'rule-based',
      fallbackActive: true,
      note: 'Ollama unavailable. Rule-based fallback active.',
    }
  }

  return {
    selectedMode: 'ollama',
    providerForRuntime: 'ollama',
    fallbackActive: false,
    note: `Ollama ready: ${localAi.ollama.selectedModel || 'selected model'}.`,
  }
}

export const canUseOllamaForChat = (
  localAi: LocalAiSettings,
  ollamaStatus: OllamaStatus,
): ChatOllamaGuardResult => {
  if (localAi.providerMode !== 'ollama') {
    return { allowed: false, reason: 'Rule-based active' }
  }
  if (!localAi.ollama.enabled) {
    return { allowed: false, reason: 'Ollama disabled, using rule-based fallback' }
  }
  if (!localAi.ollama.selectedModel.trim()) {
    return { allowed: false, reason: 'No model selected, using rule-based fallback' }
  }
  if (!isSelectedOllamaModelAvailable(localAi.ollama.selectedModel, localAi.ollama.availableModels)) {
    return {
      allowed: false,
      reason: 'Selected model is unavailable, using rule-based fallback',
    }
  }
  if (!ollamaStatus.available) {
    return { allowed: false, reason: 'Ollama unavailable, using rule-based fallback' }
  }
  return { allowed: true, reason: `Ollama ready: ${localAi.ollama.selectedModel}` }
}
