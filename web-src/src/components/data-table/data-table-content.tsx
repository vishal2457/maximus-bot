import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { flexRender } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileX } from "lucide-react";

import { cn } from "@/lib/utils";
import { type DataTableContentProps } from "./types";
import {
  Density,
  getDensityClassName,
  getDensityTransitionClasses,
} from "./features/density";

export function DataTableContent<TData, TValue>({
  table,
  columns,
  className,
  enableColumnOrdering = true,
  isLoading = false,
  loadingRowCount = 10,
  emptyMessage = "No data found",
  emptyDescription = "No results match your search criteria.",
  emptyIcon: EmptyIcon = FileX,
}: DataTableContentProps<TData, TValue>) {
  // Get current density for styling
  const density = table.getDensity?.() || Density.NORMAL;
  const densityClasses = getDensityClassName(density);
  const transitionClasses = getDensityTransitionClasses();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = table
        .getAllLeafColumns()
        .findIndex((column) => column.id === active.id);
      const newIndex = table
        .getAllLeafColumns()
        .findIndex((column) => column.id === over?.id);

      const currentOrder = table.getState().columnOrder;
      const newColumnOrder = arrayMove(
        currentOrder.length
          ? currentOrder
          : table.getAllLeafColumns().map((c) => c.id),
        oldIndex,
        newIndex
      );

      table.setColumnOrder(newColumnOrder);
    }
  };

  const getColumnOrder = () => {
    const currentOrder = table.getState().columnOrder;
    if (currentOrder.length === 0) {
      return table.getAllLeafColumns().map((c) => c.id);
    }
    return currentOrder;
  };

  const TableContent = (
    <Table className="transition-all duration-200 ease-in-out">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className={transitionClasses}>
            {/* Pinned left columns */}
            {headerGroup.headers
              .filter((header) => header.column.getIsPinned() === "left")
              .map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "sticky left-0 bg-background border-r z-20",
                    densityClasses
                  )}
                  style={{
                    left: header.column.getStart("left"),
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}

            {/* Reorderable columns (non-pinned) */}
            {enableColumnOrdering ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={getColumnOrder().filter((id) => {
                    const column = table.getColumn(id);
                    return column && !column.getIsPinned();
                  })}
                  strategy={horizontalListSortingStrategy}
                >
                  {headerGroup.headers
                    .filter((header) => !header.column.getIsPinned())
                    .map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "relative border-r border-border/30",
                          densityClasses
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                </SortableContext>
              </DndContext>
            ) : (
              headerGroup.headers
                .filter((header) => !header.column.getIsPinned())
                .map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn("border-r border-border/30", densityClasses)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))
            )}

            {/* Pinned right columns */}
            {headerGroup.headers
              .filter((header) => header.column.getIsPinned() === "right")
              .map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "sticky right-0 bg-background border-l z-20",
                    densityClasses
                  )}
                  style={{
                    right: header.column.getStart("right"),
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading ? (
          // Loading skeleton rows
          Array.from({ length: loadingRowCount }).map((_, i) => (
            <TableRow
              key={`skeleton-${i}`}
              className={cn("hover:bg-transparent", transitionClasses)}
            >
              {Array.from({ length: columns.length }).map((_, j) => (
                <TableCell
                  key={j}
                  className={cn("border-r border-border/30", densityClasses)}
                >
                  <Skeleton
                    className="h-4 w-full"
                    style={{
                      width: `${Math.floor(Math.random() * 40) + 60}%`,
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows?.length ? (
          // Data rows
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              className={transitionClasses}
            >
              {/* Pinned left cells */}
              {row
                .getVisibleCells()
                .filter((cell) => cell.column.getIsPinned() === "left")
                .map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "sticky left-0 bg-background border-r z-20",
                      densityClasses
                    )}
                    style={{
                      left: cell.column.getStart("left"),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}

              {/* Non-pinned cells */}
              {row
                .getVisibleCells()
                .filter((cell) => !cell.column.getIsPinned())
                .map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("border-r border-border/30", densityClasses)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}

              {/* Pinned right cells */}
              {row
                .getVisibleCells()
                .filter((cell) => cell.column.getIsPinned() === "right")
                .map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "sticky right-0 bg-background border-l z-20",
                      densityClasses
                    )}
                    style={{
                      right: cell.column.getStart("right"),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
            </TableRow>
          ))
        ) : (
          // Empty state
          <TableRow>
            <TableCell colSpan={columns.length} className="h-80">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <EmptyIcon className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{emptyMessage}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {emptyDescription}
                </p>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className={cn("rounded-md border", className)}>{TableContent}</div>
  );
}
