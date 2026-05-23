import Button from "../util/Button";
import { ResponsiveModal } from "../util/ResponsiveModal";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  title?: string;
  body?: string;
};

export default function NotificationPermissionModal({
  open,
  onClose,
  onOpenSettings,
  title = "Allow notifications?",
  body = "To show now playing alerts on this device, allow notifications for Nautilus in Android settings.",
}: Props) {
  return (
    <ResponsiveModal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5 md:pb-3">
        <h2>{title}</h2>
        <p className="pr-8 text-sm text-neutral-500">
          {body}
        </p>
        <Button
          text="Open notification settings"
          onClick={onOpenSettings}
          fit
          black
        />
      </div>
    </ResponsiveModal>
  );
}
