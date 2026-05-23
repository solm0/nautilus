import { Bell } from "lucide-react";
import { IconButtonEvent } from "../util/Button";
import { MiniPopup } from "../util/MiniPopup";
import { useEffect, useState } from "react";
import { fetchNotifications, fetchUnreadFlag, readNotification } from "../../api";

export function AnnotationToolbar() {
  const [openPopup, setOpenPopup] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    fetchUnreadFlag().then(res => setHasUnread(res.has_unread));
  }, []);

  useEffect(() => {
    if (openPopup) {
      fetchNotifications().then(setNotifications);
    }
  }, [openPopup]);

  const notificationList = (
    <div className="flex flex-col gap-2 w-full p-2">
      {notifications.length === 0 && (
        <div>you have no notifications</div>
      )}

      {notifications.map(n => (
        <div
          key={n.id}
          onClick={async () => {
            await readNotification(n.id);

            window.location.href =
              `/annotations?id=${n.annotation_id}`;
          }}
          className={`p-2 rounded cursor-pointer ${
            !n.is_read ? "bg-blue-100" : ""
          }`}
        >
          <div className="text-sm">
            {n.actor.name}{" "}
            {n.type === "reply"
              ? "replied to your comment"
              : "commented on your annotation"}
          </div>

          <div className="text-xs opacity-50">
            {n.created_at.slice(0, 10)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="absolute top-8 md:top-12 right-3 md:right-6 flex gap-2 z-40">

      <div className="relative">
        <IconButtonEvent
          icon={<Bell size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            setOpenPopup((v) => !v);
          }}
        />
        {hasUnread && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
        )}
        <MiniPopup
          open={openPopup}
          onClose={() => setOpenPopup(false)}
          big={true}
        >
          {notificationList}
        </MiniPopup>
      </div>
    </div>
  );
}