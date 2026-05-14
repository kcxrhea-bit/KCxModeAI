import type {
  AppData,
  AppInfo,
  NetworkStatus,
  PrivateBrowserAccessConfig,
  PrivateBrowserAccessStatus,
  OllamaCheckResponse,
  OllamaGenerateResponse,
  OllamaModelsResponse,
  OllamaStatus,
} from './types'

declare global {
  interface Window {
    godzillaAPI?: {
      loadAppData: () => Promise<AppData>
      saveAppData: (data: AppData) => Promise<AppData>
      copyText: (text: string) => Promise<boolean>
      getAppInfo: () => Promise<AppInfo>
      getNetworkStatus: () => Promise<NetworkStatus>
      startPrivateBrowserAccess: (
        config: PrivateBrowserAccessConfig,
      ) => Promise<PrivateBrowserAccessStatus>
      stopPrivateBrowserAccess: () => Promise<PrivateBrowserAccessStatus>
      getPrivateBrowserAccessStatus: () => Promise<PrivateBrowserAccessStatus>
      openDataFolder: () => Promise<boolean>
      getOllamaStatus: (url: string, selectedModel: string) => Promise<OllamaStatus>
      checkOllamaStatus: (baseUrl: string) => Promise<OllamaCheckResponse>
      listOllamaModels: (baseUrl: string) => Promise<OllamaModelsResponse>
      generateWithOllama: (
        baseUrl: string,
        model: string,
        prompt: string,
      ) => Promise<OllamaGenerateResponse>
    }
  }
}

export {}
