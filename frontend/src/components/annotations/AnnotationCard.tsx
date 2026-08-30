import { useEffect, useState } from "react";
import { deleteAnnotation, updateAnnotation, verifyToken } from "../../api";
import { formatRelative } from "../util/time";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { Link } from "react-router-dom";
import Button, { IconButton } from "../util/Button";
import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import type { TimelineItem, User } from "../../types";
import { isValidUrl } from "../pageview/AnnotationNew";
import { UserIcon } from "../setting/Setting";
import { useI18n } from "../../i18n";
import PendingSyncBadge from "../util/PendingSyncBadge";

export default function AnnotationCard({
  item, onUpdate, onDelete, readonlySnapshotActions = false,
}: {
  item: TimelineItem;
  onUpdate?: (item: TimelineItem) => void;
  onDelete?: (id: number) => void;
  readonlySnapshotActions?: boolean;
}) {
  const { locale, t } = useI18n();
  const [openModal, setOpenModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.content);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canSave, setCanSave] = useState(item.content.trim().length > 0);
  const isPendingAnnotation = item.pending_sync || item.id < 0;
  const effectiveUser = item.user ?? (isPendingAnnotation ? user : null);
  const disableSnapshotActions = readonlySnapshotActions && !isPendingAnnotation;
  
  useEffect(() => {
    verifyToken().then(setUser);
  }, []);

  useEffect(() => {
    setCanSave(value.trim().length > 0);
  }, [value]);

  const id = item.id;

  const handleDelete = async () => {
    try {
      await deleteAnnotation(item.id);
      onDelete?.(item.id);
    } finally {
      setOpenModal(false);
    }
  };

  const handleSave = async () => {
    const nextValue = value;

    // link validation
    if (item.type === "link") {
      if (!isValidUrl(nextValue)) {
        setMsg(t("Invalid URL"));
        return;
      }
    }

    try {
      const updated = await updateAnnotation(id, nextValue);
      setValue(updated.content);
      onUpdate?.({
        ...item,
        ...updated,
      });
      setEditing(false);
      setMsg(t("Saved"));
      setTimeout(()=>setMsg(null),3000);
    } catch {
      setMsg(t("Save failed"));
    }
  }

  return (
    <div
      className={`
        relative w-full pb-7 pr-3 md:pr-6 flex flex-col gap-3 group max-w-300
      `}
    >
      <div className="absolute top-10 left-3.5 h-[calc(100%-3rem)] w-1 border-l border-neutral-300" />

      {/* user & time & tools */}
      <div className={`
        sticky bg-neutral-50 flex w-full gap-2 py-3 text-sm items-center z-30
        top-16 md:top-20
        `}>
        <UserIcon user={effectiveUser} />
        <div className="flex gap-2">
          <span>
            {effectiveUser?.id === user?.id || isPendingAnnotation
              ? t("Me")
              : (effectiveUser?.name ?? t("Unknown"))}
          </span>
          <span className="text-neutral-400">
            {formatRelative(item.created_at, locale)}
          </span>
        </div>
        {isPendingAnnotation ? <PendingSyncBadge /> : null}

        {(effectiveUser?.id === user?.id || isPendingAnnotation) && item.type && !editing && (
          <div className="gap-1 ml-auto hidden group-hover:flex">
            {item.type !== 'emoji' &&
              <IconButton
                icon={<Pencil size={14} />}
                disabled={disableSnapshotActions}
                onClick={() => {
                  if (disableSnapshotActions) return;
                  setEditing(true);
                  setValue(item.content)
                }}
              />
            }
            <IconButton
              icon={<Trash2 className="text-red-600" size={14} />}
              disabled={disableSnapshotActions}
              onClick={() => setOpenModal(true)}
            />
          </div>
        )}
      </div>

      {/* body */}
      <div className={`
        w-full h-auto flex flex-col gap-4 md:flex-row z-10
        pt-0
      `}>
        
        {/* source */}
        <div className="flex-1 flex flex-col gap-2 items-end">
          <Link
            to={`/page/${item.page_id}`}
            state={{ annotationId: item.id }}
            className="flex w-auto items-center gap-2 rounded-sm bg-neutral-200 px-2 py-1 text-sm transition-colors hover:bg-neutral-300"
          >
            <p>{item.page_name}</p>
            <ArrowUpRight size={15} />
          </Link>
          <div className="w-full bg-neutral-200 p-2 rounded-sm">
            <p className="max-w-[33em]">{item.source}</p>
          </div>
        </div>

        {/* content */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex flex-col gap-7">
            {!editing
              ? item.type === 'link'
                ? <a href={value} className="underline underline-offset-3 hover:text-neutral-400 transition-colors" target="_blank">{value}</a>
                : <div
                    className={`
                      whitespace-pre-wrap leading-7 bg-neutral-50
                      ${item.type === 'emoji' ? 'text-6xl pt-3 overflow-visible' : 'overflow-hidden'}
                    `}
                  >
                    <p className="max-w-[33rem]">
                      {value.length <= 300 ? value : expanded ? value : value.slice(0, 300) + '...'}
                    </p>

                    {!editing && item.type === 'memo' && value.length > 300 &&
                      <button
                        className="flex gap-1 text-sm items-center text-neutral-400 hover:text-neutral-600 transition-colors mt-1"
                        onClick={()=>setExpanded(!expanded)}
                      >
                        {expanded ? t("hide") : t("more")}
                      </button>
                    }
                  </div>
              : item.type === 'link'
                ? <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="border-2 border-neutral-300 rounded px-2 py-1 focus:outline-none"
                  />
                : <textarea
                    key={item.id}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="w-full min-h-80 max-h-96 resize-none bg-transparent leading-7 pb-8 text-base text-inherit caret-black focus:outline-none placeholder-neutral-400 overflow-y-auto"
                    spellCheck={false}
                    placeholder={t("Add your thoughts...")}
                    autoFocus
                  />
            }

            {editing &&
              <div className="flex flex-col gap-2">
                {msg && <p className="text-sm opacity-70">{msg}</p>}
                <div className="self-end flex gap-2 pb-4 w-full">
                  <Button
                  text={t("Revert changes")}
                    onClick={()=>{
                      setEditing(false);
                      setMsg(null);
                    }}
                    black fit
                  />
                  <Button
                    text={t("Save changes")}
                    onClick={handleSave}
                    disabled={!canSave}
                    black fit
                  />
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      {/* delete modal */}
      <ResponsiveModal open={openModal} onClose={() => setOpenModal(false)}>
        <div className="flex flex-col gap-7 md:pb-3">
          <h2>{t("Delete this annotation?")}</h2>
          <Button text={t("Delete")} onClick={handleDelete} fit red/>
        </div>
      </ResponsiveModal>

    </div>
  );
}
