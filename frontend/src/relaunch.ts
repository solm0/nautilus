import { isElectronApp } from "./platform";

export async function relaunchApp() {
  if (isElectronApp() && window.electronAPI?.relaunchApp) {
    await window.electronAPI.relaunchApp();
    return;
  }

  window.location.reload();
}
