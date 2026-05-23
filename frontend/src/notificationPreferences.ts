import { registerPlugin } from "@capacitor/core";

import { isCapacitorApp } from "./platform";

const PROMPT_SEEN_KEY = "nautilus_notification_prompt_seen";

type AndroidNotificationPlugin = {
  getNotificationPermissionStatus(): Promise<NotificationPermissionStatus>;
  openNotificationSettings(): Promise<void>;
};

const AndroidNowPlaying = registerPlugin<AndroidNotificationPlugin>("NowPlaying");

export type AppNotificationPermissionStatus = NotificationPermissionStatus;

export function hasSeenNotificationPrompt() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(PROMPT_SEEN_KEY) === "true";
}

export function markNotificationPromptSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROMPT_SEEN_KEY, "true");
}

export async function getAppNotificationPermissionStatus(): Promise<AppNotificationPermissionStatus> {
  if (!isCapacitorApp()) {
    return {
      granted: true,
      can_request: false,
    };
  }

  try {
    return await AndroidNowPlaying.getNotificationPermissionStatus();
  } catch (error) {
    console.error("[notifications][android] getNotificationPermissionStatus failed:", error);
    return {
      granted: false,
      can_request: false,
    };
  }
}

export async function openAppNotificationSettings() {
  if (!isCapacitorApp()) return;

  try {
    await AndroidNowPlaying.openNotificationSettings();
  } catch (error) {
    console.error("[notifications][android] openNotificationSettings failed:", error);
  }
}
