import { Button } from "@/components/ui/button";
import { useMarkNotificationRead, useNotifications } from "@/hooks/queries/useNotifications";

const timeAgo = (createdAt: string) => {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
};

const Notifications = () => {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Notifications</h1>
      <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
        {notifications.map((n) => (
          <div key={n._id} className="flex items-center justify-between px-6 py-5">
            <div>
              <p className="font-semibold text-card-foreground">{n.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{timeAgo(n.createdAt)}</span>
              <Button size="sm" className="rounded-full px-6" onClick={() => markRead.mutate(n._id)} disabled={n.isRead || markRead.isPending}>
                {n.isRead ? "Read" : "Accept"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Notifications;
