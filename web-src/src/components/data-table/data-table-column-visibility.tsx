import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ColumnsIcon } from "lucide-react";
import { type DataTableColumnVisibilityProps } from "./types";
import {
  Density,
  getDensityLabel,
  getDensityTransitionClasses,
  type DensityState,
} from "./features/density";

export function DataTableColumnVisibility<TData>({
  table,
  className,
}: DataTableColumnVisibilityProps<TData>) {
  const currentDensity = table.getDensity?.() || Density.NORMAL;
  const densityOptions: DensityState[] = [
    Density.COMPACT,
    Density.NORMAL,
    Density.WIDE,
  ];
  const transitionClasses = getDensityTransitionClasses();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn(" p-1 rounded-none", className)}>
          <ColumnsIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Density ({getDensityLabel(currentDensity)})
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {densityOptions.map((density) => (
                  <DropdownMenuItem
                    key={density}
                    onClick={() => table.setDensity?.(density)}
                    className={cn(
                      "cursor-pointer",
                      transitionClasses,
                      currentDensity === density && "bg-accent"
                    )}
                  >
                    {getDensityLabel(density)}
                    {currentDensity === density && " ✓"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Columns</DropdownMenuLabel>
          {table
            .getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
