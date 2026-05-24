import { FilePlusCorner, FolderPlus, Type } from "lucide-react";
import { Link } from "react-router-dom";
import Button, { IconButtonEvent } from "../util/Button";
import { MiniPopup } from "../util/MiniPopup";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { useState } from "react";
import { CENTRAL_API } from "../../api";
import { isCapacitorApp } from "../../platform";

function CreateNotebookContent({
  onCreate,
  onClose
}: {
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  async function handleCreate() {
    if (!name.trim()) return;
    await onCreate(name);
    onClose(); // 생성 후 닫기
  }

  return (
    <div className="flex flex-col gap-7">
      <h2 className="text-lg font-medium">Create Notebook</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Notebook name"
        className="border-2 border-neutral-300 rounded-sm px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
        autoFocus
      />
      <Button
        disabled={!name.trim()}
        onClick={handleCreate}
        text="Create"
        fit
        black
      />
    </div>
  );
}

export function Toolbar({
  reload,
}: {
  reload: () => Promise<void>;
}) {
  const mobileApp = isCapacitorApp();
  const [openFilePopup, setOpenFilePopup] = useState(false);
  const [openFolderModal, setOpenFolderModal] = useState(false);

  const fileOptions = (
    <>
      <Link
        to='/new'
        className="w-full px-3 py-2 hover:bg-neutral-100 text-left flex items-center gap-2">
        <Type size={16} />
        Paste text
      </Link>
    </>
  )

  const createNotebook = async (name: string) => {
    if (!name.trim()) return;

    const token = localStorage.getItem("token");

    await fetch(CENTRAL_API + "/notebooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });

    await reload();
  };

  return (
    <>
      <div className={`flex ${mobileApp ? 'gap-2': 'gap-1'}`}>
        <IconButtonEvent
          icon={<FolderPlus size={mobileApp ? 16 : 14} />}
          onClick={() => setOpenFolderModal(true)}
          title="Create Notebook"
        />

        {/* Page */}
        <div className="relative">
          <IconButtonEvent
            icon={<FilePlusCorner size={mobileApp ? 16 : 14} />}
            onClick={(e) => {
              e.stopPropagation();
              setOpenFilePopup((v) => !v);
            }}
            title="Create Page"
          />
          <MiniPopup
            open={openFilePopup}
            onClose={() => setOpenFilePopup(false)}
          >
            {fileOptions}
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
