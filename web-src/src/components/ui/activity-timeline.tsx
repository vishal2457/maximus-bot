import * as React from "react";
import { cn } from "@/lib/utils";

interface ActivityTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function ActivityTimeline({
  className,
  children,
  ...props
}: ActivityTimelineProps) {
  return (
    <div className={cn("flex flex-col gap-0", className)} {...props}>
      {children}
    </div>
  );
}

interface ActivityTimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isLast?: boolean;
}

function ActivityTimelineItem({
  className,
  children,
  isLast = false,
  ...props
}: ActivityTimelineItemProps) {
  return (
    <div
      className={cn("relative flex gap-4 min-h-[48px]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function ActivityTimelineTime({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-20 pt-1 text-right text-sm text-muted-foreground tabular-nums shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function ActivityTimelineSeparator({
  className,
  children,
  isLast = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { isLast?: boolean }) {
  return (
    <div
      className={cn("relative flex flex-col items-center shrink-0", className)}
      {...props}
    >
      <div className="flex items-center justify-center p-1.5">{children}</div>
      {!isLast && (
        <div className="w-px grow bg-border -mt-1" aria-hidden="true" />
      )}
    </div>
  );
}

function ActivityTimelineDot({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "size-3 rounded-full border-2 border-border bg-background",
        className,
      )}
      {...props}
    />
  );
}

function ActivityTimelineHeaderDot({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("size-3 rounded-full bg-emerald-500", className)}
      {...props}
    />
  );
}

function ActivityTimelineContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-1 gap-2 pt-0.5 pb-6", className)} {...props}>
      {children}
    </div>
  );
}

function ActivityTimelineIcon({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function ActivityTimelineTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-sm font-medium pt-0.5 text-muted-foreground uppercase tracking-wider",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export {
  ActivityTimeline,
  ActivityTimelineItem,
  ActivityTimelineTime,
  ActivityTimelineSeparator,
  ActivityTimelineDot,
  ActivityTimelineHeaderDot,
  ActivityTimelineContent,
  ActivityTimelineIcon,
  ActivityTimelineTitle,
};
