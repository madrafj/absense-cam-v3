import { useEffect, useState, useMemo } from 'react';
import { attendanceDb } from '../lib/db';
import type { AttendanceRecord } from '../lib/db';
import { History, Search, Trash2, ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';

const columnHelper = createColumnHelper<AttendanceRecord>();

export default function HistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [filteredGroup, setFilteredGroup] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    const records: AttendanceRecord[] = [];
    const groups = new Set<string>();

    await attendanceDb.iterate((value: AttendanceRecord) => {
      records.push(value);
      if (value.groupId) groups.add(value.groupId);
    });
    
    records.sort((a, b) => b.timestamp - a.timestamp);
    setData(records);
    setAvailableGroups(Array.from(groups));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearHistory = async () => {
    if (confirm("Are you sure you want to clear all attendance history?")) {
      await attendanceDb.clear();
      loadData();
    }
  };

  // Compute filtered
  const filteredData = useMemo(() => {
    if (filteredGroup === 'ALL') return data;
    return data.filter(r => r.groupId === filteredGroup);
  }, [data, filteredGroup]);

  const columns = [
    columnHelper.accessor('userName', {
      header: 'Student Name',
      cell: info => <span className="font-bold text-base">{info.getValue()}</span>,
    }),
    columnHelper.accessor('groupId', {
      header: 'Group / Class',
      cell: info => <span className="badge badge-neutral shadow-sm font-mono text-xs">{info.getValue() || 'Unknown'}</span>,
    }),
    columnHelper.accessor('timestamp', {
      header: 'Date & Time',
      cell: info => {
        const d = new Date(info.getValue());
        return <span className="badge badge-primary badge-outline font-medium whitespace-nowrap">{d.toLocaleString()}</span>;
      },
    }),
    columnHelper.accessor('id', {
      header: 'Actions',
      cell: info => (
        <button 
          className="btn btn-ghost btn-sm text-error bg-error/10 hover:bg-error hover:text-error-content transition-colors"
          onClick={async () => {
            await attendanceDb.removeItem(info.getValue());
            loadData();
          }}
        >
          Remove
        </button>
      ),
      enableSorting: false,
    }),
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex flex-col h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm z-10 px-4">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6"/> Back
        </button>
        <div className="mx-auto font-bold text-lg hidden sm:block">Attendance History</div>
      </div>

      <div className="flex-1 w-full max-w-6xl mx-auto p-4 lg:p-8 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-3xl font-black flex items-center gap-3">
             <div className="p-3 bg-primary/10 rounded-xl text-primary"><History className="w-6 h-6"/></div>
             Database Logs
          </h2>
          
          <div className="flex gap-4 w-full sm:w-auto">
             <div className="join w-full sm:w-auto flex-1">
                <div className="btn join-item pointer-events-none bg-base-100 border border-base-300">
                  <Filter className="w-4 h-4"/> Group:
                </div>
                <select 
                  className="select select-bordered join-item flex-1 focus:outline-none"
                  value={filteredGroup}
                  onChange={e => setFilteredGroup(e.target.value)}
                >
                  <option value="ALL">All Groups</option>
                  {availableGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
             </div>
             <button className="btn btn-error btn-outline shadow-sm" onClick={clearHistory} disabled={data.length === 0}>
               <Trash2 className="w-5 h-5 sm:mr-2"/> <span className="hidden sm:inline">Clear Full History</span>
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-base-100 rounded-3xl shadow-xl border border-base-300">
          <div className="overflow-x-auto overflow-y-auto flex-1 p-0 sm:p-6">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <span className="loading loading-spinner text-primary loading-lg"></span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex justify-center flex-col items-center h-full text-base-content/50 p-10 text-center">
                <Search className="w-16 h-16 mb-4 opacity-30"/>
                <p className="text-xl font-bold">No Records Found</p>
                <p className="text-sm mt-2">Adjust your grouping filters or capture fresh attendance records.</p>
              </div>
            ) : (
              <table className="table table-zebra table-pin-rows w-full text-base lg:text-lg">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th 
                          key={header.id} 
                          onClick={header.column.getToggleSortingHandler()}
                          className={`bg-base-200 text-base-content font-bold tracking-wide py-4 border-b border-base-300 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-base-300 transition-colors' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="text-sm sm:text-base">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-base-200/50 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination */ }
          {filteredData.length > 0 && (
            <div className="bg-base-200 p-4 border-t border-base-300 flex justify-between items-center z-10 shrink-0">
               <div className="text-sm font-semibold text-base-content/60">
                 Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
               </div>
               <div className="flex gap-2">
                 <button 
                   className="btn btn-sm btn-outline shadow-sm" 
                   onClick={() => table.previousPage()} 
                   disabled={!table.getCanPreviousPage()}
                 >
                   Prev
                 </button>
                 <button 
                   className="btn btn-sm btn-outline shadow-sm" 
                   onClick={() => table.nextPage()} 
                   disabled={!table.getCanNextPage()}
                 >
                   Next
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
