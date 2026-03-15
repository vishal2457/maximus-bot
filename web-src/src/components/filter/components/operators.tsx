import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useContext, useState } from "react";
import type { FilterValue } from "../filter.model";
import { FilterContext } from "../filter";

const textOperators = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  doesNotContain: "does not contain",
  startsWith: "starts with",
  doesNotStartWith: "does not start with",
  endsWith: "ends with",
  doesNotEndWith: "does not end with",
};

const dateOperators = {
  is: "is",
  isNot: "is not",
  isAfter: "is after",
  isBefore: "is before",
};

const selectOperators = {
  is: "is",
  isNot: "is not",
};

export const operators = {
  text: textOperators,
  date: dateOperators,
  selectStatic: selectOperators,
};

export const FilterOperatorContainer = ({
  filter,
}: {
  filter: FilterValue;
}) => {
  const { filterActions } = useContext(FilterContext);
  const [open, setOpen] = useState<boolean>(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="m-0 h-full w-fit whitespace-nowrap rounded-none p-0 px-2 text-xs"
        >
          <span>{filter.operator}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-fit p-0 origin-(--radix-popover-content-transform-origin)"
      >
        <Command loop>
          <CommandInput placeholder="Search" />
          <CommandEmpty>No results.</CommandEmpty>
          <CommandList className="max-h-fit">
            {Object.entries(
              operators[filter.type as keyof typeof operators]
            ).map(([key, value]) => (
              <CommandItem
                key={key}
                onSelect={() => {
                  filterActions.modifyFilter({
                    ...filter,
                    operator: value,
                  });
                  setOpen(false);
                }}
              >
                <span>{value}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
