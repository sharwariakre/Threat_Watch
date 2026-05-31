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
import type { LogEntry } from "@/types/analysis";

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

export function LogTable({ entries }: { entries: LogEntry[] }) {
  const [ipFilter, setIpFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const data = useMemo(() => {
    return entries.filter((e) => {
      const ipOk = ipFilter ? e.ip.includes(ipFilter.trim()) : true;
      const statusOk = statusFilter
        ? String(e.status).startsWith(statusFilter.trim())
        : true;
      return ipOk && statusOk;
    });
  }, [entries, ipFilter, statusFilter]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Entries</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          <Input
            placeholder="Filter by IP…"
            value={ipFilter}
            onChange={(e) => setIpFilter(e.target.value)}
            className="h-9 max-w-[200px]"
          />
          <Input
            placeholder="Filter by status (e.g. 4)…"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 max-w-[200px]"
          />
        </div>
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    row.original.flagged && "bg-red-500/10 hover:bg-red-500/15"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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
