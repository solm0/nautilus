import { matchPath, Outlet, useLocation, useNavigate } from "react-router-dom";
import { verifyToken } from "../api";
import { useState, useEffect } from "react";
import { File, MessageSquareMore, Settings2, Star } from "lucide-react";
import type { User } from "../types";
import { IconButton } from "./util/Button";
import { MiniPopup } from "./util/MiniPopup";
import { SettingToggle } from "./util/ToggleButton";
import { useSettings } from "./useSettings";

const LAST_PAGE_PATH_STORAGE_KEY = "last-page-path";

export function Side() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const {
      settings,
      toggleSetting,
    } = useSettings();

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const mobile = coarse || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const normalMenus = [
    { label: <File size={isMobile ? 20 : 16} />, path: "/", title: 'pages' },
    { label: <MessageSquareMore size={isMobile ? 20 : 16} />, path: "/annotations", title: 'annotations' },
    { label: <Star size={isMobile ? 20 : 16} />, path: "/lemmas", title: 'lemmas' },
  ];

  const handleMenuClick = (path: string) => {
    if (path !== "/") {
      navigate(path);
      return;
    }

    if (matchPath("/page/:id", location.pathname)) {
      navigate("/");
      return;
    }

    const lastPagePath = window.sessionStorage.getItem(LAST_PAGE_PATH_STORAGE_KEY);
    navigate(lastPagePath || "/");
  };

  const content = normalMenus.map((menu) => {
    const active = location.pathname === menu.path;
    return (
      <IconButton key={menu.path} icon={menu.label} title={menu.title} onClick={() => handleMenuClick(menu.path)} active={active}/>
    );
  })

  const settingsButtons = isMobile ? (
    <IconButton
      icon={<Settings2 size={20} />}
      title="settings"
      onClick={() => navigate("/setting")}
      active={location.pathname === "/setting" || openSettings === true}
    />
  ) : (
    <div
      className="relative"
      onMouseEnter={() => location.pathname.startsWith('/page') && setOpenSettings(true)}
    >
      <IconButton
        icon={<Settings2 size={16} />}
        title="settings"
        active={
          location.pathname === "/setting" || openSettings
        }
        onClick={() => navigate("/setting")}
      />

      <MiniPopup
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        left row
      >
        <div className="flex flex-col gap-3 min-w-[180px] p-2">
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
      </MiniPopup>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 h-14 w-full border-t bg-neutral-transparent border-neutral-200 flex justify-around p-3 text-sm items-center z-50 backdrop-blur-sm">
        {content}
        {settingsButtons}
      </div>
    )
  } else return (
    <div className="pt-12 top-0 left-0 h-full w-9 bg-neutral-transparent border-neutral-300 flex flex-col text-sm items-center gap-2 z-50">
      {content}
      {settingsButtons}
    </div>
  )
}

export default function HomeLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (matchPath("/page/:id", location.pathname)) {
      window.sessionStorage.setItem(
        LAST_PAGE_PATH_STORAGE_KEY,
        location.pathname + location.search + location.hash,
      );
    }
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    verifyToken().then((u) => {
      setUser(u);
    });
  }, []);

  useEffect(() => {
    if (user === undefined) return; // 아직 로딩 중
    if (!user) {
      navigate("/login");
    }
  }, [user]);

  return (
    <div className="h-screen w-screen overflow-hidden flex">
      <Side />

      {/* Main Content */}
      <div className={`flex-1 overflow-hidden`}>
        <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
          <Outlet context={user} />
        </div>
      </div>
    </div>
  );
}
