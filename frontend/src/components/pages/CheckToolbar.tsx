import { FolderInput, Trash2 } from "lucide-react";
import { IconButton } from "../util/Button";
import type { SelectedItem } from "./PageLayout";

export default function CheckToolbar({
  selectedItems,
  clear,
  onMove,
  onDelete
}: {
  selectedItems: SelectedItem[];
  clear: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const pageIds = selectedItems
    .filter(i => i.type === "page")
    .map(i => i.id);
  return (
    <div className="flex gap-1 h-6">
      <IconButton icon={
        <div className="flex gap-1 items-center">
          <span className="text-xs pb-px">clear</span>
        </div>
      } onClick={clear}/>
      <IconButton icon={<FolderInput size={14} />} onClick={onMove} disabled={pageIds.length === 0}/>
      <IconButton icon={<Trash2 className="text-red-600" size={14} />} onClick={onDelete}/>
    </div>
  );
}
