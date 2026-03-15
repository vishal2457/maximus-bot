import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Ellipsis } from "lucide-react";
import { useMemo } from "react";
import { type FilterValue } from "../filter.model";

export const FilterTextDisplay = ({ filter }: { filter: FilterValue }) => {
  if (!filter) return null;
  if (filter.value?.toString().trim() === "")
    return <Ellipsis className="size-4" />;

  const value = filter.value.toString();

  return <span>{value}</span>;
};

function formatDateRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
  }

  if (sameYear) {
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }

  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}

export const FilterDateDisplay = ({ filter }: { filter: FilterValue }) => {
  if (!filter) return null;
  if (!Array.isArray(filter.value)) return null;

  if (filter.value.length === 0) return null;

  if (filter.value.length === 1) {
    const value = filter.value[0];

    const formattedDateStr = format(value, "MMM d, yyyy");

    return <span>{formattedDateStr}</span>;
  }

  const formattedRangeStr = formatDateRange(
    filter.value[0] as Date,
    filter.value[1] as Date
  );

  return <span>{formattedRangeStr}</span>;
};

const take = (arr: any[], n: number) => {
  return arr.slice(0, n);
};

export function FilterSelectDisplay({ filter }: { filter: FilterValue }) {
  const options = useMemo(() => filter.staticOptions, [filter.staticOptions]);
  const selected = options?.filter((o: any) =>
    (filter?.value as string[])?.includes(o.value)
  );
  if (!selected) return null;
  if (selected.length === 1) {
    const { label, icon } = selected[0];
    return (
      <span className="inline-flex items-center gap-1">
        {icon}
        <span>{label}</span>
      </span>
    );
  }
  const name = filter.label.toLowerCase();
  // TODO: Better pluralization for different languages
  const pluralName = name.endsWith("s") ? `${name}es` : `${name}s`;

  const hasOptionIcons = !options?.some((o: any) => !o.icon);

  return (
    <div className="inline-flex items-center gap-0.5">
      {hasOptionIcons &&
        take(selected, 3).map(({ icon }) => {
          return icon;
        })}
      <span className={cn(hasOptionIcons && "ml-1.5")}>
        {selected.length} {pluralName}
      </span>
    </div>
  );
}
