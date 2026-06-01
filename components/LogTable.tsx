"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { X, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Anomaly, LogEntry } from "@/types/analysis";

export interface LogFilters {
  ip: string;
  status: string;
}

const columns: ColumnDef<LogEntry>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "ip",
    header: "IP",
    cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span>,
  },
  { accessorKey: "method", header: "Method" },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ getValue }) => (
      <span className="block max-w-[260px] truncate font-mono text-xs">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const s = getValue<number>();
      return (
        <span
          className={cn(
            "font-mono",
            s >= 500 ? "text-red-400" : s >= 400 ? "text-amber-400" : "text-emerald-400"
          )}
        >
          {s}
        </span>
      );
    },
  },
  {
    accessorKey: "bytes",
    header: "Bytes",
    cell: ({ getValue }) => (
      <span className="tabular-nums">{getValue<number>().toLocaleString()}</span>
    ),
  },
];

export function LogTable({
  entries,
  filters,
  onFiltersChange,
  anomalies = [],
  onViewAnomaly,
}: {
  entries: LogEntry[];
  filters: LogFilters;
  onFiltersChange: (f: LogFilters) => void;
  anomalies?: Anomaly[];
  onViewAnomaly?: (ip: string) => void;
}) {
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const anomalyByIp = useMemo(() => {
    const m = new Map<string, Anomaly>();
    for (const a of anomalies) if (!m.has(a.ip)) m.set(a.ip, a);
    return m;
  }, [anomalies]);

  const data = useMemo(() => {
    return entries.filter((e) => {
      const ipOk = filters.ip ? e.ip.includes(filters.ip.trim()) : true;
      const statusOk = filters.status
        ? String(e.status).startsWith(filters.status.trim())
        : true;
      return ipOk && statusOk;
    });
  }, [entries, filters.ip, filters.status]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const hasFilter = Boolean(filters.ip || filters.status);
  const filterLabel = [
    filters.ip || null,
    filters.status ? `Status ${filters.status}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Entries</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          <Input
            placeholder="Filter by IP…"
            value={filters.ip}
            onChange={(e) => onFiltersChange({ ...filters, ip: e.target.value })}
            className="h-9 max-w-[200px]"
          />
          <Input
            placeholder="Filter by status (e.g. 4)…"
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="h-9 max-w-[200px]"
          />
        </div>

        {hasFilter && (
          <div className="mt-2 flex w-fit items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
            <span>Showing logs for {filterLabel}</span>
            <button
              type="button"
              aria-label="Clear log filters"
              onClick={() => onFiltersChange({ ip: "", status: "" })}
              className="rounded p-0.5 hover:bg-primary/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-20 text-center text-muted-foreground">
                  No matching log entries.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const flagged = row.original.flagged;
                const isOpen = openRowId === row.id;
                const anomaly = anomalyByIp.get(row.original.ip);
                return (
                  <TableRow
                    key={row.id}
                    onClick={
                      flagged
                        ? () => setOpenRowId(isOpen ? null : row.id)
                        : undefined
                    }
                    className={cn(
                      "relative",
                      flagged && "cursor-pointer bg-red-500/10 hover:bg-red-500/15"
                    )}
                  >
                    {row.getVisibleCells().map((cell, ci) => (
                      <TableCell key={cell.id} className={ci === 0 ? "relative" : undefined}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        {ci === 0 && isOpen && flagged && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-full left-0 z-20 mb-1 w-80 max-w-[80vw] rounded-md border border-border bg-card p-3 text-left shadow-lg"
                          >
                            <div className="mb-1 font-mono text-xs font-semibold">
                              {row.original.ip}
                            </div>
                            {anomaly ? (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  {anomaly.reason}
                                </p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    Confidence {Math.round(anomaly.confidence * 100)}%
                                  </span>
                                  {onViewAnomaly && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onViewAnomaly(row.original.ip);
                                        setOpenRowId(null);
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                      View anomaly
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Flagged entry.
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {data.length} {data.length === 1 ? "entry" : "entries"} ·{" "}
            page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
