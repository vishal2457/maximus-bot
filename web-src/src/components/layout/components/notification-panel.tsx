import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, X, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface Notification {
  id: string;
  title: string;
  description: string;
  date: Date;
  read: boolean;
  type?: "info" | "warning" | "success" | "error";
}

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDeleteNotification?: (id: string) => void;
  className?: string;
}

export function NotificationPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  className,
}: NotificationPanelProps) {
  const [open, setOpen] = React.useState(false);

  const unreadNotifications = notifications.filter((n) => !n.read);
  const unreadCount = unreadNotifications.length;

  const handleMarkAsRead = (id: string) => {
    onMarkAsRead?.(id);
  };

  const handleMarkAllAsRead = () => {
    onMarkAllAsRead?.();
  };

  const handleDeleteNotification = (id: string) => {
    onDeleteNotification?.(id);
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20";
      case "error":
        return "bg-red-500/10 border-red-500/20";
      default:
        return "bg-blue-500/10 border-blue-500/20";
    }
  };

  const NotificationItem = ({
    notification,
  }: {
    notification: Notification;
  }) => (
    <div
      className={cn(
        "p-4 border-b border-border/40 last:border-b-0 transition-colors hover:bg-accent/50",
        !notification.read && "bg-accent/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4
              className={cn(
                "text-sm font-medium leading-none",
                !notification.read && "font-semibold"
              )}
            >
              {notification.title}
            </h4>
            {!notification.read && (
              <div className="h-2 w-2 bg-blue-500 rounded-full" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(notification.date, { addSuffix: true })}
            </span>
            {notification.type && (
              <Badge
                variant="outline"
                className={cn("text-xs", getTypeColor(notification.type))}
              >
                {notification.type}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleMarkAsRead(notification.id)}
            >
              <Check className="h-3 w-3" />
              <span className="sr-only">Mark as read</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleDeleteNotification(notification.id)}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Delete notification</span>
          </Button>
        </div>
      </div>
    </div>
  );

  // Desktop: Popover with full notification panel
  const DesktopNotificationPanel = () => (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("relative", className)}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 backdrop-blur-xl bg-background/95"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto p-1"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <Tabs defaultValue="unread">
          <TabsList className="grid grid-cols-2 h-9 mb-0 w-full bg-transparent border-b-1 rounded-none">
            <TabsTrigger
              value="unread"
              className="text-xs rounded-sm border-none"
            >
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs rounded-sm border-none">
              All ({notifications.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="mt-0">
            <ScrollArea className="h-80">
              {unreadNotifications.length > 0 ? (
                unreadNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No unread notifications</p>
                  <p className="text-xs">You're all caught up!</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-80">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                  <p className="text-xs">
                    We'll notify you when something happens
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="p-2">
          <Button variant="ghost" className="w-full justify-center text-xs h-8">
            <MoreHorizontal className="h-3 w-3 mr-1" />
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Mobile: Dropdown with simplified notification list
  const MobileNotificationDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("relative", className)}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 max-h-96 overflow-y-auto backdrop-blur-xl bg-background/95"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto p-1"
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-3 border-b border-border/40 last:border-b-0 transition-colors hover:bg-accent/50",
                  !notification.read && "bg-accent/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium leading-none">
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {notification.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(notification.date, {
                          addSuffix: true,
                        })}
                      </span>
                      {notification.type && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            getTypeColor(notification.type)
                          )}
                        >
                          {notification.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <Check className="h-3 w-3" />
                        <span className="sr-only">Mark as read</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteNotification(notification.id)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Delete notification</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {notifications.length > 5 && (
              <div className="p-3 text-center text-xs text-muted-foreground border-t border-border/40">
                +{notifications.length - 5} more notifications
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        )}

        <Separator />
        <div className="p-2">
          <Button variant="ghost" className="w-full justify-center text-xs h-8">
            <MoreHorizontal className="h-3 w-3 mr-1" />
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {/* Desktop: Show Popover */}
      <div className="hidden md:block">
        <DesktopNotificationPanel />
      </div>

      {/* Mobile: Show Dropdown */}
      <div className="md:hidden">
        <MobileNotificationDropdown />
      </div>
    </>
  );
}

export default NotificationPanel;
