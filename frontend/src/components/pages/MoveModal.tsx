import { useMemo, useState } from "react";

import type { Notebook } from "./PageLayout";
import { ResponsiveModal } from "../util/ResponsiveModal";
import Button from "../util/Button";
import { CENTRAL_API, authHeaders } from "../../api";

function buildNotebookOptions(
  notebooks: Notebook[],
  parentId: number | null = null,
  level = 0
): Array<{ id: number; name: string }> {
  return notebooks
    .filter((notebook) => (notebook.parent_id ?? null) === parentId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .flatMap((notebook) => [
      {
        id: notebook.id,
        name: `${"\u00A0\u00A0".repeat(level)}${level > 0 ? "↳ " : ""}${notebook.name}`,
      },
      ...buildNotebookOptions(notebooks, notebook.id, level + 1),
    ]);
}

export default function MoveModal({
  open,
  onClose,
  pageIds,
  pageLabel,
  notebooks,
  reload,
}: {
  open: boolean;
  onClose: () => void;
  pageIds: number[];
  pageLabel?: string;
  notebooks: Notebook[];
  reload: () => Promise<void>;
}) {
  const [selectedNotebook, setSelectedNotebook] = useState<number | null>(null);

  const notebookOptions = useMemo(
    () => buildNotebookOptions(notebooks),
    [notebooks]
  );

  if (pageIds.length === 0) return null;

  const movePages = async (notebookId: number | null) => {
    const headers = authHeaders();
    if (!headers) throw new Error("unauthorized");

    await fetch(CENTRAL_API + "/pages/move", {
      method: "POST",
      headers,
      body: JSON.stringify({
        page_ids: pageIds,
        notebook_id: notebookId,
      }),
    });

    setSelectedNotebook(null);
    onClose();
    await reload();
  };

  return (
    <ResponsiveModal open={open} onClose={onClose}>
      <div className="flex flex-col gap-7">
        <h2>
          Move {pageIds.length > 1 ? `${pageIds.length} pages` : `page "${pageLabel ?? ""}"`}
        </h2>

        <select
          value={selectedNotebook ?? ""}
          onChange={(event) =>
            setSelectedNotebook(
              event.target.value ? Number(event.target.value) : null
            )
          }
          className="border-2 border-neutral-300 rounded-sm px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
        >
          <option value="">(root)</option>
          {notebookOptions.map((notebook) => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.name}
            </option>
          ))}
        </select>

        <Button
          text="Move"
          onClick={() => movePages(selectedNotebook)}
          fit
          black
        />
      </div>
    </ResponsiveModal>
  );
}
