const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('godzillaAPI', {
  loadAppData: () => ipcRenderer.invoke('godzilla:load-data'),
  saveAppData: (data: unknown) => ipcRenderer.invoke('godzilla:save-data', data),
  copyText: (text: string) => ipcRenderer.invoke('godzilla:copy-text', text),
  getAppInfo: () => ipcRenderer.invoke('godzilla:get-app-info'),
  getNetworkStatus: () => ipcRenderer.invoke('godzilla:get-network-status'),
  startPrivateBrowserAccess: (config: unknown) =>
    ipcRenderer.invoke('godzilla:start-private-browser-access', config),
  stopPrivateBrowserAccess: () => ipcRenderer.invoke('godzilla:stop-private-browser-access'),
  getPrivateBrowserAccessStatus: () =>
    ipcRenderer.invoke('godzilla:get-private-browser-access-status'),
  openDataFolder: () => ipcRenderer.invoke('godzilla:open-data-folder'),
  getOllamaStatus: (url: string, selectedModel: string) =>
    ipcRenderer.invoke('godzilla:get-ollama-status', url, selectedModel),
  checkOllamaStatus: (baseUrl: string) =>
    ipcRenderer.invoke('godzilla:check-ollama-status', baseUrl),
  listOllamaModels: (baseUrl: string) =>
    ipcRenderer.invoke('godzilla:list-ollama-models', baseUrl),
  generateWithOllama: (baseUrl: string, model: string, prompt: string) => {
    console.info(
      '[GodzillaModeAI] Preload stage: ollama_invoke_called',
      JSON.stringify({ baseUrl, model, promptLength: prompt.length }),
    )
    return ipcRenderer.invoke('godzilla:generate-with-ollama', baseUrl, model, prompt)
  },
})
