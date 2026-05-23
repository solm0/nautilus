import { useEffect, useRef, useState } from "react";
import type { Comment } from "../../types";
import { createComment, deleteComment, getComments, updateComment } from "../../api";
import NgramToggleInput, { type NgramToggleInputHandle } from "../pageview/NgramToggleInput";
import Button, { IconButton } from "../util/Button";
import { Pencil, Trash2 } from "lucide-react";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { formatRelative } from "../util/time";
import { UserIcon } from "../setting/Setting";

export function CommentInput({
  onSubmit,resetSignal,
}: {
  onSubmit: (text: string) => void;
  resetSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const inputRef = useRef<NgramToggleInputHandle>(null);

  useEffect(() => {
    setValue("");
  }, [resetSignal]);

  useEffect(() => {
    setCanSubmit(value.trim().length > 0);
  }, [value]);

  if (!open) {
    return (
      <div
        className="w-full py-2 px-3 bg-neutral-100 rounded-full border border-neutral-300 text-neutral-400 z-20 hover:bg-neutral-200 transition-colors text-sm"
        onClick={()=>setOpen(!open)}
      >
        Add a comment
      </div>
    )
  } else {
    return (
      <div className="flex flex-col gap-1">

        <p className="text-xs pl-9 text-neutral-400">You're adding a comment</p>
        <div className="relative flex flex-col gap-7 items-end bg-neutral-50 border-y border-neutral-300 p-2">
        
          <div className="min-h-80 h-auto w-full">
            <NgramToggleInput
              ref={inputRef}
              key={resetKey}
              value={value}
              onChange={setValue}
              onHasTextChange={setCanSubmit}
              background cut
            />
          </div>

          <div className="w-full gap-2 flex">
            <Button
              text="Cancel"
              onClick={()=>setOpen(false)}
              black fit
            />
            <Button
              text="Post"
              onClick={async () => {
                const nextValue = inputRef.current?.flushPendingInput() ?? value;
                if (!nextValue.trim()) return;

                await onSubmit(nextValue);
                setResetKey(k => k + 1);
                setValue("");
                setOpen(false)
              }}
              disabled={!canSubmit}
              black fit
            />
          </div>
        </div>
      </div>
    )
  }
}

export default function CommentItem({
  c,
  annotationId, userId,
  setComments, setCommentCount,
}: {
  c: Comment & { children?: any[] };
  annotationId: number;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  userId?: number;
  setCommentCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.content);
  const [openModal, setOpenModal] = useState(false);
  const [replyReset, setReplyReset] = useState(0);
  const [canSave, setCanSave] = useState(c.content.trim().length > 0);
  const inputRef = useRef<NgramToggleInputHandle>(null);

  useEffect(() => {
    setCanSave(value.trim().length > 0);
  }, [value]);


  const handleSave = async () => {
    const nextValue = inputRef.current?.flushPendingInput() ?? value;
    await updateComment(c.id, nextValue);
    setComments(prev =>
      prev.map(x => x.id === c.id ? { ...x, content: nextValue } : x)
    );
    setValue(nextValue);
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteComment(c.id);
    setComments(prev =>
      prev.map(x => x.id === c.id ? { ...x, deleted: true } : x)
    );
    setCommentCount(c => Math.max(0, c - 1));
    setOpenModal(false);
  };

  const handleReply = async (text: string) => {
    await createComment(annotationId, {
      content: text,
      parent_id: c.id,
    });

    const data = await getComments(annotationId);
    setComments(data);
    setReplyReset(r => r + 1);
  };

  return (
    <div
      className={`
        relative flex flex-col gap-2 z-20
        ${c.deleted && c.children?.length === 0 && 'hidden'}
      `}
    >
      <div className="absolute top-13 left-10.5 h-[calc(100%-3rem)] w-1 border-l border-neutral-300" />

      {/* user & time & tools */}
      <div className="flex w-full gap-2 py-3 text-xs items-center pl-7">
        <UserIcon user={c.user} />
        <div className="flex gap-2">
          <span>
            {c.deleted
              ? 'Unknown user'
              : c.user?.id === userId
                ? 'Me'
                : (c.user?.name ?? 'Unknown user')}
          </span>
          <span className="text-neutral-400">
            {c.deleted
              ? ''
              : (formatRelative(c.created_at) ?? 'Unknown date')}
          </span>
        </div>

        {!c.deleted && c.user?.id === userId && (
          <div className="flex gap-1 ml-auto">
            <IconButton icon={<Pencil size={14} />} onClick={() => setEditing(true)} />
            <IconButton icon={<Trash2 className="text-red-600" size={14} />} onClick={() => setOpenModal(true)} />
          </div>
        )}
      </div>

      {/* body */}
      <div className="pl-7 flex flex-col gap-3 pb-5">
        {!editing ? (
          <div className="pl-9 whitespace-pre-wrap text-sm">
            {c.deleted ? "[deleted]" : c.content}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs pl-9 text-neutral-400">You're editing a comment</p>
            <div className="relative flex flex-col gap-7 items-end bg-neutral-50 border-y border-neutral-300 p-2">
              <div className="min-h-80 h-auto w-full">
                <NgramToggleInput
                  ref={inputRef}
                  value={value}
                  onChange={setValue}
                  onHasTextChange={setCanSave}
                  cut background
                />
              </div>

              <div className="w-full gap-2 flex">
                <Button
                  text="Cancel"
                  onClick={()=>setEditing(false)}
                  black fit
                />
                <Button
                  text="Save changes"
                  onClick={handleSave}
                  disabled={!canSave}
                  black fit
                />
              </div>
            </div>
          </div>
        )}

        {!c.deleted && !c.parent_id && (
          <div className="z-20">
            <CommentInput onSubmit={handleReply} resetSignal={replyReset} />
          </div>
        )}

        {/* children */}
        <div className="flex flex-col-reverse gap-1 pl-1">
          {c.children?.map(child => (
            <CommentItem
              key={child.id}
              c={child}
              annotationId={annotationId}
              setComments={setComments}
              userId={userId}
              setCommentCount={setCommentCount}
            />
          ))}
        </div>
      </div>

      <ResponsiveModal open={openModal} onClose={() => setOpenModal(false)}>
        <div className="flex flex-col gap-5 md:pb-3">
          <h2>Delete this comment?</h2>
          <Button text="Delete" onClick={handleDelete} fit black/>
        </div>
      </ResponsiveModal>
    </div>
  );
}
