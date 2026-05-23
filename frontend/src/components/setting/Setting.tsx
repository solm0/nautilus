import { useEffect, useState } from "react";
import {
  deleteAccount,
  updateName,
  verifyToken,
} from "../../api";
import { Check, Pencil } from "lucide-react";
import { type User } from "../../types";
import Button, { IconButtonEvent } from "../util/Button";
import { useNavigate } from "react-router-dom";
import Mutuals from "./Mutuals";
import MyCommentsModal from "./MyCommentsModal";
import PackTable from "./PackTable";
import ThemeToggle, { SettingToggle } from "../util/ToggleButton";
import { useSettings } from "../useSettings";
import { isCapacitorApp } from "../../platform";
import { ResponsiveModal } from "../util/ResponsiveModal";
import NotificationPermissionModal from "./NotificationPermissionModal";
import {
  getAppNotificationPermissionStatus,
  openAppNotificationSettings,
  type AppNotificationPermissionStatus,
} from "../../notificationPreferences";

export function UserIcon({user}: {user?: User | null}) {
  let hash = 0;
  let color = "hsl(0, 0%, 80%)";
  let textColor = "#fff";
  let text = "";

  if (user && user.email && user.name) {
    for (let i = 0; i < user.email.length; i++) {
      hash = user.email.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash % 360);

    const saturation = 65;
    const lightness = 55;

    color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    textColor = lightness > 60 ? "#111" : "#fff";


    const trimmed = user.name.trim();

    if (trimmed.includes(" ")) {
      text = trimmed
        .split(/\s+/)
        .slice(0, 2)
        .map((v) => v[0])
        .join("")
        .toUpperCase();
    } else text = trimmed.slice(0, 2).toUpperCase();
  }

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{
        backgroundColor: color,
        color: textColor,
      }}
    >
      <span className="font-medium">
        {text || null}
      </span>
    </div>
  );
}

export function UserProfile() {
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [value, setValue] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    verifyToken().then(setUser);
  }, []);

  useEffect(() => {
    if (user?.name) {
      setValue(user.name);
    }
  }, [user]);

  async function handleSave() {
    await updateName(value);
    setUser((prev) =>
      prev ? { ...prev, name: value } : prev
    );
    setEditing(false);
  }

  function logout() {
    localStorage.removeItem("token")
    navigate("/login");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError("");

    try {
      await deleteAccount();
      localStorage.removeItem("token");
      navigate("/login");
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete account.",
      );
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 mb-14 items-start">
        <div className="w-full flex items-center gap-3">

          <UserIcon user={user} />

          {/* name */}
          {editing ? (
            <input
              className="border-b border-neutral-400 focus:outline-none"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          ) : (
            <div>{user?.name}</div>
          )}

          {/* button */}
          {editing ? (
            <IconButtonEvent
              icon={<Check size={14} />}
              onClick={handleSave}
            />
          ) : (
            <IconButtonEvent
              icon={<Pencil size={13} />}
              onClick={()=>setEditing(true)}
            />
          )}
        </div>

        <p>E-mail: {user?.email}</p>
        <MyCommentsModal />
        <Button onClick={logout} text="Logout" black />
        <Button
          onClick={() => {
            setDeleteError("");
            setOpenDeleteModal(true);
          }}
          text="Delete account"
          disabled={deleting}
          black
        />
      </div>

      <ResponsiveModal open={openDeleteModal} onClose={() => setOpenDeleteModal(false)}>
        <div className="flex flex-col gap-5 md:pb-3">
          <h2>Delete account?</h2>
          <p className="pr-8 text-sm text-neutral-500">
            Your data will all disappear. Pages, annotations, comments, mutuals, and saved language data will be removed permanently.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <Button
            text={deleting ? "Deleting..." : "Delete"}
            onClick={handleDeleteAccount}
            disabled={deleting}
            fit
            black
          />
        </div>
      </ResponsiveModal>
    </>
  );
}

export default function Setting() {
  const mobileApp = isCapacitorApp();
  const [notificationPermission, setNotificationPermission] =
    useState<AppNotificationPermissionStatus | null>(null);
  const [openNotificationModal, setOpenNotificationModal] = useState(false);
  const {
    settings,
    toggleSetting,
    setSettings,
  } = useSettings();

  useEffect(() => {
    if (!mobileApp) return;

    let cancelled = false;

    const loadPermission = async () => {
      const next = await getAppNotificationPermissionStatus();
      if (!cancelled) {
        setNotificationPermission(next);
      }
    };

    void loadPermission();
    window.addEventListener("focus", loadPermission);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadPermission);
    };
  }, [mobileApp]);

  async function handleNowPlayingNotificationsToggle() {
    const nextValue = !settings.now_playing_notifications;

    if (!nextValue) {
      setSettings((prev) => ({
        ...prev,
        now_playing_notifications: false,
      }));
      return;
    }

    setSettings((prev) => ({
      ...prev,
      now_playing_notifications: true,
    }));

    const permission = await getAppNotificationPermissionStatus();
    setNotificationPermission(permission);

    if (!permission.granted) {
      setOpenNotificationModal(true);
    }
  }

  async function handleOpenNotificationSettings() {
    setOpenNotificationModal(false);
    await openAppNotificationSettings();
  }

  return (
    <>
      <div className="w-full h-full overflow-y-scroll overflow-x-hidden flex flex-col gap-7 pr-3 z-30 pl-3 md:pl-6 bg-neutral-50 pb-7">
        <h2 className="sticky top-0 pt-8 md:pt-12 bg-neutral-50">Preferences</h2>
        <section className="w-full h-auto mb-14 flex flex-col gap-7">
        <div className="flex flex-col gap-4">
          <h3>Page view</h3>
          <div className="flex flex-col items-start text-sm gap-2">

            <div className="flex items-center gap-2">
              <span>lemma info</span>
              <SettingToggle
                settingKey="lemma_info"
                value={settings.lemma_info}
                toggleSetting={toggleSetting}
              />
            </div>
            <div className="flex items-center gap-2">
              <span>nsubj</span>
              <SettingToggle
                settingKey="highlight_nsubj"
                value={settings.highlight_nsubj}
                toggleSetting={toggleSetting}
              />
            </div>
            <div className="flex items-center gap-2">
              <span>root</span>
              <SettingToggle
                settingKey="highlight_root"
                value={settings.highlight_root}
                toggleSetting={toggleSetting}
              />
            </div>
            <div className="flex items-center gap-2">
              <span>obj</span>
              <SettingToggle
                settingKey="highlight_obj"
                value={settings.highlight_obj}
                toggleSetting={toggleSetting}
              />
            </div>
          </div>
        </div>

        {mobileApp && (
          <div className="flex flex-col gap-4">
            <h3>Notifications</h3>
            <div className="flex flex-col items-start text-sm gap-2">
              <div className="flex items-center gap-2">
                <span>now playing alerts</span>
                <button
                  type="button"
                  onClick={handleNowPlayingNotificationsToggle}
                  aria-pressed={settings.now_playing_notifications}
                  title="now playing alerts"
                  className={`
                    relative inline-flex h-5 w-9 items-center rounded-full
                    p-0.5 transition-colors
                    ${
                      settings.now_playing_notifications
                        ? "bg-neutral-700"
                        : "bg-neutral-300"
                    }
                  `}
                >
                  <div
                    className={`
                      h-4 w-4 rounded-full bg-white shadow-sm
                      transition-transform duration-200
                      ${
                        settings.now_playing_notifications
                          ? "translate-x-4"
                          : "translate-x-0"
                      }
                    `}
                  />
                </button>
              </div>
              {settings.now_playing_notifications && notificationPermission && !notificationPermission.granted && (
                <button
                  type="button"
                  className="text-left text-xs text-neutral-500 underline underline-offset-2 cursor-pointer"
                  onClick={() => setOpenNotificationModal(true)}
                >
                  Notifications are blocked on this device. Open settings.
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <h3>Theme</h3>
          <div>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3>System language</h3>
        </div>
        </section>

        <h2 className="sticky top-0 pt-8 md:pt-12 bg-neutral-50">Language Packs</h2>
        <p className="text-sm">
          {mobileApp
            ? "Activate only the languages you want to use on this device."
            : "To reduce storage, keep a single language version."}
        </p>
        <section className="w-full h-auto mb-14 flex flex-col gap-4">
          <PackTable />
        </section>
        
        <h2 className="sticky top-0 pt-8 md:pt-12 bg-neutral-50">Mutuals</h2>
        <Mutuals />

        <h2 className="sticky top-0 pt-8 md:pt-12 bg-neutral-50">Profile</h2>
        <UserProfile />
      </div>

      <NotificationPermissionModal
        open={openNotificationModal}
        onClose={() => setOpenNotificationModal(false)}
        onOpenSettings={handleOpenNotificationSettings}
      />
    </>
  );
}
