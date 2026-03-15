import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Pin,
  PinOff,
} from "lucide-react";
import { type Column } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  canSort?: boolean;
  canHide?: boolean;
  canReorder?: boolean;
  canPin?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  canSort = true,
  canHide = true,
  canReorder = true,
  canPin = true,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!column.getCanSort() && !canSort) {
    return <div className={cn(className)}>{title}</div>;
  }

  const getSortIcon = () => {
    const sortDirection = column.getIsSorted();
    if (sortDirection === "desc") {
      return <ArrowDown className="ml-2 h-4 w-4" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ChevronsUpDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center space-x-2",
        isDragging && "opacity-50",
        className
      )}
    >
      {/* Drag Handle */}
      {canReorder && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 p-0 px-2 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
          <span className="sr-only">Drag to reorder column</span>
        </Button>
      )}

      {/* Sort Button */}
      {canSort && column.getCanSort() ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 data-[state=open]:bg-accent"
          onClick={() => {
            const currentSort = column.getIsSorted();
            if (currentSort === "desc") {
              column.clearSorting();
            } else if (currentSort === "asc") {
              column.toggleSorting(true);
            } else {
              column.toggleSorting(false);
            }
          }}
        >
          <span>{title}</span>
          {getSortIcon()}
        </Button>
      ) : (
        <span className="font-medium">{title}</span>
      )}

      {/* Column Options Menu */}
      {(canHide || canSort || canPin) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 w-8 p-0 data-[state=open]:bg-accent"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open column menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            {canSort && column.getCanSort() && (
              <>
                <DropdownMenuItem
                  onClick={() => column.toggleSorting(false)}
                  className="flex items-center"
                >
                  <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                  Asc
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => column.toggleSorting(true)}
                  className="flex items-center"
                >
                  <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                  Desc
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => column.clearSorting()}
                  className="flex items-center"
                >
                  <ChevronsUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                  Clear
                </DropdownMenuItem>
                {(canHide || canPin) && <DropdownMenuSeparator />}
              </>
            )}
            {canPin && (
              <>
                <DropdownMenuItem
                  onClick={() => column.pin("left")}
                  className="flex items-center"
                >
                  <Pin className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                  Pin Left
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => column.pin("right")}
                  className="flex items-center"
                >
                  <Pin className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                  Pin Right
                </DropdownMenuItem>
                {column.getIsPinned() && (
                  <DropdownMenuItem
                    onClick={() => column.pin(false)}
                    className="flex items-center"
                  >
                    <PinOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                    Unpin
                  </DropdownMenuItem>
                )}
                {canHide && <DropdownMenuSeparator />}
              </>
            )}
            {canHide && (
              <DropdownMenuItem
                onClick={() => column.toggleVisibility(false)}
                className="flex items-center"
              >
                <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Hide
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
