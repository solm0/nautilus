import { useState } from "react";
import { ArrowUpRight, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { deleteAnnotation, updateAnnotation } from "../../api";
import { useI18n } from "../../i18n";
import type { TimelineItem } from "../../types";
import AnnotationInput from "../pageview/AnnotationInput";
import { isValidUrl } from "../pageview/AnnotationNew";
import Button, { IconButtonEvent } from "../util/Button";
import { MiniPopup } from "../util/MiniPopup";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { formatRelative } from "../util/time";

export default function AnnotationCard({ item, onUpdate, onDelete, readonlySnapshotActions = false }: {
  item: TimelineItem;
  onUpdate?: (item: TimelineItem) => void;
  onDelete?: (id: string) => void;
  readonlySnapshotActions?: boolean;
}) {
  const { locale, t } = useI18n();
  const [value, setValue] = useState(item.content);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const nextValue = value.trim();
    if (!nextValue || !item.type || item.type === "emoji") return;
    if (item.type === "link" && !isValidUrl(nextValue)) {
      setError(t("Invalid URL"));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAnnotation(item.id, nextValue);
      setValue(updated.content);
      onUpdate?.({ ...item, ...updated });
      setEditing(false);
      setError(null);
    } catch {
      setError(t("Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await deleteAnnotation(item.id);
    onDelete?.(item.id);
    setDeleteOpen(false);
  };

  return (
    <article className="group relative h-auto w-full flex flex-col md:w-96 border-r border-b shadow-sm rounded-xl border-neutral-200 hover:bg-neutral-100 transition-colors px-3 py-2">

        <time className="text-[10px] text-neutral-400">{formatRelative(item.created_at, locale)}</time>
        <div className="flex min-h-10 flex-col gap-4">
          {editing && item.type && item.type !== "emoji" ? (
            <AnnotationInput
              type={item.type}
              value={value}
              onChange={(next) => { setValue(next); setError(null); }}
              onSubmit={() => void save()}
              disabled={saving || !value.trim()}
              error={error}
            />
          ) : item.type === "link" ? (
            <a href={value} target="_blank" rel="noreferrer" className="truncate text-sm underline underline-offset-3 hover:text-neutral-400">{value}</a>
          ) : (
            <p className={`whitespace-pre-wrap break-words ${item.type === "emoji" ? "text-4xl leading-none" : "text-sm leading-6"}`}>{value}</p>
          )}

        </div>

        {!readonlySnapshotActions && !editing ? (
          <div className={`absolute right-2 top-2 transition-opacity ${menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`}>
            <IconButtonEvent
              icon={<Ellipsis size={14} />}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              title={t("more")}
            />
            <MiniPopup open={menuOpen} onClose={() => setMenuOpen(false)}>
              <div className="flex flex-col">
                {item.type !== "emoji" ? (
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-neutral-100" onClick={() => { setEditing(true); setMenuOpen(false); }}>
                    <Pencil size={13} />
                    <span>{t("Edit")}</span>
                  </button>
                ) : null}
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50" onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}>
                  <Trash2 size={13} />
                  <span>{t("Delete")}</span>
                </button>
              </div>
            </MiniPopup>
          </div>
        ) : null}

      <Link to={`/page/${item.page_id}`} state={{ annotationId: item.id }} className="flex min-w-0 items-start group gap-2 text-xs transition-colors rounded-b-lg mt-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-neutral-500">{item.page_name}</span>
          <span className="block truncate mt-1 text-neutral-400">{item.source}</span>
        </span>
        <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-neutral-400 group-hover:text-neutral-700" />
      </Link>

      <ResponsiveModal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="flex flex-col gap-7 md:pb-3">
          <h2>{t("Delete this annotation?")}</h2>
          <Button text={t("Delete")} onClick={() => void remove()} fit red />
        </div>
      </ResponsiveModal>
    </article>
  );
}
