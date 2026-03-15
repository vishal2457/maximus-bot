import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { type DataTablePaginationProps } from "./types";
import { cn } from "@/lib/utils";

export function DataTablePagination<TData>({
  table,
  className,
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (pageCount <= maxVisiblePages) {
      for (let i = 0; i < pageCount; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(0, currentPage - 2);
      const end = Math.min(pageCount - 1, currentPage + 2);

      if (start > 0) {
        pages.push(0);
        if (start > 1) pages.push(-1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < pageCount - 1) {
        if (end < pageCount - 2) pages.push(-1);
        pages.push(pageCount - 1);
      }
    }

    return pages;
  };

  return (
    <div className={cn("flex items-center justify-end space-x-2 ", className)}>
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex items-center space-x-2 border rounded-md ">
        <Pagination>
          <PaginationContent className="p-1">
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronFirst className="rtl:rotate-180" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="rtl:rotate-180" />
              </Button>
            </PaginationItem>

            {/* Page number buttons */}
            {getPageNumbers().map((pageIndex, index) => (
              <PaginationItem key={index}>
                {pageIndex === -1 ? (
                  <PaginationEllipsis />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => table.setPageIndex(pageIndex)}
                    data-selected={pageIndex === currentPage}
                    className={pageIndex === currentPage ? "bg-accent" : ""}
                  >
                    {pageIndex + 1}
                  </Button>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="rtl:rotate-180" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronLast className="rtl:rotate-180" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
