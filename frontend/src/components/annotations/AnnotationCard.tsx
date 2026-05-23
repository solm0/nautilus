import { useEffect, useRef, useState } from "react";
import { createComment, deleteAnnotation, getComments, updateAnnotation, verifyToken } from "../../api";
import { formatRelative } from "../util/time";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { Link } from "react-router-dom";
import Button, { IconButton } from "../util/Button";
import { ArrowUpRight, ChevronUp, MessageCircle, Pencil, Trash2 } from "lucide-react";
import type { TimelineItem } from "../setting/Mutuals";
import type { Comment, User } from "../../types";
import CommentItem, { CommentInput } from "./CommentItem";
import { isValidUrl } from "../pageview/AnnotationNew";
import NgramToggleInput, { type NgramToggleInputHandle } from "../pageview/NgramToggleInput";
import { UserIcon } from "../setting/Setting";

export default function AnnotationCard({
  item, autoOpenComments, pinned = false, onUpdate, onDelete
}: {
  item: TimelineItem;
  autoOpenComments: boolean;
  pinned?: boolean;
  onUpdate?: (item: TimelineItem) => void;
  onDelete?: (id: number) => void;
}) {
  const [openModal, setOpenModal] = useState(false);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [commentCount, setCommentCount] = useState(item.comment_count);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.content);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canSave, setCanSave] = useState(item.content.trim().length > 0);
  const inputRef = useRef<NgramToggleInputHandle>(null);
  
  useEffect(() => {
    verifyToken().then(setUser);
  }, []);

  useEffect(() => {
    if (item.type !== "memo") {
      setCanSave(value.trim().length > 0);
    }
  }, [item.type, value]);

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
    const nextValue = item.type === "memo"
      ? inputRef.current?.flushPendingInput() ?? value
      : value;

    // link validation
    if (item.type === "link") {
      if (!isValidUrl(nextValue)) {
        setMsg("Invalid URL");
        return;
      }
    }

    try {
      const updated = await updateAnnotation(id, nextValue);
      setValue(updated.content);
      onUpdate?.({
        ...item,
        ...updated,
        comment_count: item.comment_count,
      });
      setEditing(false);
      setMsg("Saved");
      setTimeout(()=>setMsg(null),3000);
    } catch {
      setMsg("Save failed");
    }
  }

  // 댓글 열기/fetch
  async function toggleComments() {
    if (open) {
      setOpen(false);
      return;
    }

    if (comments.length > 0) {
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const data = await getComments(item.id);
      setComments(data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  // 트리 구성 (flat -> 구조)
  function buildTree(comments: Comment[]) {
    const map = new Map<number, Comment & { children: Comment[] }>();

    comments.forEach(c => {
      map.set(c.id, { ...c, children: [] });
    });

    const roots: (Comment & { children: Comment[] })[] = [];

    map.forEach(c => {
      if (c.parent_id) {
        map.get(c.parent_id)?.children.push(c);
      } else {
        roots.push(c);
      }
    });

    return roots;
  }

  // 알림에서 왔을 시 댓글창 열기
  useEffect(() => {
    if (!autoOpenComments) return;

    let cancelled = false;

    setOpen(true);

    getComments(item.id).then((data) => {
      if (!cancelled) {
        setComments(prev => {
          // 이미 있으면 덮어쓰기 방지
          if (prev.length > 0) return prev;
          return data;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [autoOpenComments, item.id]);

  return (
    <div
      className={`
        relative w-full pb-7 pr-3 md:pr-6 flex flex-col gap-3 group
        ${autoOpenComments && 'pt-8 md:pt-12'} max-w-300
      `}
    >
      <div className="absolute top-10 left-3.5 h-[calc(100%-3rem)] w-1 border-l border-neutral-300" />

      {/* user & time & tools */}
      <div className={`
        sticky bg-neutral-50 flex w-full gap-2 py-3 text-sm items-center z-30
        ${pinned ? 'top-0 pt-10' : 'top-16 md:top-20'}
        `}>
        <UserIcon user={item.user} />
        <div className="flex gap-2">
          <span>
            {item.user?.id === user?.id
              ? "Me"
              : (item.user?.name ?? "Unknown")}
          </span>
          <span className="text-neutral-400">
            {formatRelative(item.created_at)}
          </span>
        </div>

        {item.user?.id === user?.id && item.type && !editing && !autoOpenComments && (
          <div className="gap-1 ml-auto hidden group-hover:flex">
            {item.type !== 'emoji' &&
              <IconButton
                icon={<Pencil size={14} />}
                onClick={() => {
                  setEditing(true);
                  setValue(item.content)
                }}
              />
            }
            <IconButton
              icon={<Trash2 className="text-red-600" size={14} />}
              onClick={() => setOpenModal(true)}
            />
          </div>
        )}
      </div>

      {/* body */}
      <div className={`
        w-full h-auto flex flex-col gap-4 md:flex-row z-10
        ${pinned ? 'pt-5' : 'pt-0'}
      `}>
        
        {/* source */}
        <div className="flex-1 flex flex-col gap-2 items-end">
          <Link
            to={`/page/${item.page_id}`}
            state={{ annotationId: item.id }}
            className="w-auto text-sm bg-neutral-200 px-2 py-1 rounded-sm hover:bg-neutral-300 transition-colors flex gap-2 items-center"
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
                        {expanded ? 'hide' : 'more'}
                      </button>
                    }
                  </div>
              : item.type === 'link'
                ? <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="border-2 border-neutral-300 rounded px-2 py-1 focus:outline-none"
                  />
                : <NgramToggleInput
                    ref={inputRef}
                    key={item.id}
                    value={value}
                    onChange={setValue}
                    onHasTextChange={setCanSave}
                    defaultOn={true}
                    cut background
                  />
            }

            {editing &&
              <div className="flex flex-col gap-2">
                {msg && <p className="text-sm opacity-70">{msg}</p>}
                <div className="self-end flex gap-2 pb-4 w-full">
                  <Button
                    text="Revert changes"
                    onClick={()=>{
                      setEditing(false);
                      setMsg(null);
                    }}
                    black fit
                  />
                  <Button
                    text={"Save changes"}
                    onClick={handleSave}
                    disabled={loading || !canSave}
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
          <h2>Delete this annotation?</h2>
          <Button text="Delete" onClick={handleDelete} fit black/>
        </div>
      </ResponsiveModal>

      {/* comments */}
      <button
        onClick={toggleComments}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-200 self-start z-10 text-sm hover:bg-neutral-300 transition-colors"
      >
        <MessageCircle size={13} />
        {commentCount}
        {open && <ChevronUp size={13} />}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-7">
          {/* new comment */}
          <CommentInput
            onSubmit={async (text) => {
              const newC = await createComment(item.id, { content: text });
              setComments(prev => [
                ...prev,
                {
                  ...newC,
                  user: {
                    id: user?.id,
                    name: user?.name ?? "",
                    email: user?.email ?? "",
                  }
                }
              ]);
              setCommentCount(c => c + 1);
            }}
          />

          {/* list */}
          <div className="flex flex-col-reverse gap-1">
            {buildTree(comments).map(c => (
              <CommentItem
                key={c.id}
                c={c}
                annotationId={item.id}
                setComments={setComments}
                userId={user?.id}
                setCommentCount={setCommentCount}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
