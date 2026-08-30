import { Folder, Globe2, Music4, Plus, Search, Type } from "lucide-react";
import { Link } from "react-router-dom";
import Button, { IconButtonEvent } from "../util/Button";
import { MiniPopup } from "../util/MiniPopup";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { useState } from "react";
import { authHeaders, CENTRAL_API } from "../../api";
import { centralFetch } from "../../network";
import { isNetworkError } from "../../network";
import { queueOfflineNotebookCreate } from "../../offlineData";
import { isCapacitorApp } from "../../platform";
import { useI18n } from "../../i18n";

function CreateNotebookContent({
  onCreate,
  onClose
}: {
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const { t } = useI18n();
  async function handleCreate() {
    if (!name.trim()) return;
    await onCreate(name);
    onClose(); // 생성 후 닫기
  }

  return (
    <div className="flex flex-col gap-7">
      <h2>{t("Create Notebook")}</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("Notebook name")}
        className="border-2 border-neutral-300 rounded-sm px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
        autoFocus
      />
      <Button
        disabled={!name.trim()}
        onClick={handleCreate}
        text={t("Create")}
        fit
        black
      />
    </div>
  );
}

export function Toolbar({
  reload,
  onSearch,
  disabled = false,
}: {
  reload: () => Promise<void>;
  onSearch: () => void;
  disabled?: boolean;
}) {
  const mobileApp = isCapacitorApp();
  const { t } = useI18n();
  const [openFilePopup, setOpenFilePopup] = useState(false);
  const [openFolderModal, setOpenFolderModal] = useState(false);

  const createOptions = (
    <>
      <button
        type="button"
        onClick={() => {
          setOpenFilePopup(false);
          setOpenFolderModal(true);
        }}
        className="w-full px-3 pt-3 pb-2.5 hover:bg-neutral-100 text-left flex items-center gap-2"
      >
        <Folder size={16} />
        {t("Create folder")}
      </button>
      <div className="mx-2 border-t border-neutral-200" />
      <Link
        to='/new'
        onClick={() => setOpenFilePopup(false)}
        className="w-full px-3 py-2 hover:bg-neutral-100 text-left flex items-center gap-2">
        <Type size={16} />
        {t("Paste text")}
      </Link>
      <Link
        to='/lyric'
        onClick={() => setOpenFilePopup(false)}
        className="w-full px-3 py-2 hover:bg-neutral-100 text-left flex items-center gap-2">
        <Music4 size={15} />
        {t("Get lyrics")}
      </Link>
      {!mobileApp ? (
        <a
          href="https://chromewebstore.google.com/detail/nautilus/fedaaafnilhpkoknpbkkppicjkalgflk?hl=ko"
          target="_blank"
          rel="noreferrer"
          onClick={() => setOpenFilePopup(false)}
          className="w-full px-3 py-2 hover:bg-neutral-100 text-left flex items-center gap-2"
        >
          <Globe2 size={15} />
          {t("Chrome browser")}
        </a>
      ) : null}
    </>
  )

  const createNotebook = async (name: string) => {
    if (!name.trim()) return;

    const headers = authHeaders();

    if (!headers) {
      return;
    }

    try {
      await centralFetch(CENTRAL_API + "/notebooks", {
        method: "POST",
        headers,
        body: JSON.stringify({ name })
      });
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      await queueOfflineNotebookCreate(name);
    }

    await reload();
  };

  return (
    <>
      <div
        className={`flex ${mobileApp ? 'gap-2': 'gap-1'}`}
      >
        <IconButtonEvent
          icon={<Search size={mobileApp ? 16 : 14} />}
          onClick={onSearch}
          title={t("Search")}
        />

        <div className="relative">
          <IconButtonEvent
            icon={<Plus size={mobileApp ? 16 : 15} />}
            onClick={(e) => {
              e.stopPropagation();
              setOpenFilePopup((v) => !v);
            }}
            title={t("Create")}
            disabled={disabled}
          />
          <MiniPopup
            open={openFilePopup}
            onClose={() => setOpenFilePopup(false)}
          >
            {createOptions}
          </MiniPopup>
        </div>
      </div>

      {/* Create Notebook Modal */}
      <ResponsiveModal
        open={openFolderModal}
        onClose={() => setOpenFolderModal(false)}
      >
        <CreateNotebookContent
          onCreate={createNotebook}
          onClose={() => setOpenFolderModal(false)}
        />
      </ResponsiveModal>
    </>
  );
}
