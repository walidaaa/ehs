import { ChevronRight, ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

const pageSizeOptions = [10, 30, 50];

export const PaginationControls = ({ page, totalPages, pageSize, totalItems, onPageChange, onPageSizeChange }: Props) => {
  const { t, dir } = useLanguage();
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 font-cairo text-sm" dir={dir}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{t.showing}</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="neu-flat-sm rounded-lg bg-background px-2 py-1 text-xs outline-none"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>{t.of} {totalItems}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="neu-flat-sm rounded-lg p-1.5 disabled:opacity-30 hover:scale-105 transition-transform"
        >
          {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                pageNum === page
                  ? "gradient-primary text-primary-foreground"
                  : "neu-flat-sm hover:scale-105"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="neu-flat-sm rounded-lg p-1.5 disabled:opacity-30 hover:scale-105 transition-transform"
        >
          {dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
