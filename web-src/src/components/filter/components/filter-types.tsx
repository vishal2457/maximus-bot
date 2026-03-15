import { Input } from "@/components/ui/input";
import { debounce } from "@/lib/utils/debounce";
import { isEqual } from "date-fns";
import { useCallback, useContext, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "../../ui/calendar";
import { Checkbox } from "../../ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../ui/command";
import { Label } from "../../ui/label";
import { FilterContext } from "../filter";
import { type FilterValue } from "../filter.model";
import { operators } from "./operators";

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounceMs = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounceMs?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const debouncedOnChange = useCallback(
    debounce((newValue: string | number) => {
      onChange(newValue);
    }, debounceMs),
    [debounceMs, onChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedOnChange(newValue);
  };

  return <Input {...props} value={value} onChange={handleChange} />;
};

export const FilterDebouncedInput = ({ filter }: { filter: FilterValue }) => {
  const { filterActions } = useContext(FilterContext);

  const changeHandler = (value: string | number) => {
    if (value.toString().trim() === "") {
      filterActions.removeFilter(filter.columnId);
      return;
    }

    filterActions.addFilter({
      ...filter,
      value,
      operator: operators.text.is,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>{filter.label}</Label>
      <DebouncedInput
        {...filter.textProps}
        value={String(filter.value)}
        onChange={changeHandler}
      />
    </div>
  );
};

export const FilterDateController = ({ filter }: { filter: FilterValue }) => {
  const { filterActions } = useContext(FilterContext);
  const [date, setDate] = useState<DateRange | undefined>({
    from:
      filter?.value instanceof Array ? new Date(filter?.value[0]) : new Date(),
    to: filter?.value instanceof Array ? new Date(filter?.value[1]) : undefined,
  });

  function changeDateRange(value: DateRange | undefined) {
    const start = value?.from;
    const end =
      start && value && value.to && !isEqual(start, value.to)
        ? value.to
        : undefined;

    setDate({ from: start, to: end });

    const isRange = start && end;
    const newValues = isRange ? [start, end] : start ? [start] : [];

    if (newValues.length === 0) {
      filterActions.removeFilter(filter.columnId);
      return;
    }

    filterActions.addFilter({
      ...filter,
      value: newValues,
      operator: operators.date.is,
    });
  }

  return (
    <Command>
      <CommandList className="max-h-fit">
        <CommandGroup>
          <div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={changeDateRange}
              numberOfMonths={1}
            />
          </div>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

export const FilterStaticOptions = ({ filter }: { filter: FilterValue }) => {
  const { filterActions } = useContext(FilterContext);

  const [selectedOptions, setSelectedOptions] = useState<any[]>([]);

  useEffect(() => {
    if (!filter.value) return;
    if (!Array.isArray(filter.value)) return;

    if (filter.value.length === 0) {
      filterActions.removeFilter(filter.columnId);
      return;
    }

    setSelectedOptions(
      filter.staticOptions
        ?.filter((option) => (filter.value as string[]).includes(option.value))
        .map((option) => option.value) || []
    );
  }, [filter.value]);

  const handleToggle = (value: string, checked: boolean) => {
    if (checked) {
      filterActions.addFilter({
        ...filter,
        value: [...selectedOptions, value],
        operator: operators.selectStatic.is,
      });
    } else {
      filterActions.modifyFilter({
        ...filter,
        value: selectedOptions.filter((option) => option !== value),
        operator: operators.selectStatic.is,
      });
    }
  };

  return (
    <Command loop>
      <CommandInput autoFocus placeholder="Search" />
      <CommandEmpty>No results.</CommandEmpty>
      <CommandList className="max-h-fit">
        <CommandGroup>
          {filter.staticOptions?.map((option) => (
            <CommandItem
              key={option.value}
              onSelect={() => {
                handleToggle(
                  option.value,
                  !selectedOptions.includes(option.value)
                );
              }}
              className="group flex items-center justify-between gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={selectedOptions.includes(option.value)}
                  className="opacity-0 data-[state=checked]:opacity-100 group-data-[selected=true]:opacity-100 dark:border-ring mr-1"
                />
                {option.icon}
                <span>{option.label}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
};
