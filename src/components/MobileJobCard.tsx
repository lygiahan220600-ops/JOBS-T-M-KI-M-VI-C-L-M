import React from 'react';
import { Heart, MapPin, Clock, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { Job, Language } from '../types';
import { useTranslation } from '../data/translations';

interface MobileJobCardProps {
  job: Job;
  isSaved: boolean;
  hasApplied: boolean;
  matchReasons?: string[];
  lang: Language;
  onSelect: (job: Job) => void;
  onToggleSave: (jobId: string, e: React.MouseEvent) => void;
  onApplyQuick?: (job: Job, e: React.MouseEvent) => void;
  onOpenMessage?: (job: Job, e: React.MouseEvent) => void;
}

export const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  isSaved,
  hasApplied,
  matchReasons,
  lang,
  onSelect,
  onToggleSave,
  onApplyQuick,
  onOpenMessage,
}) => {
  const t = useTranslation(lang);
  const title = lang === 'en' && job.titleEn ? job.titleEn : job.title;
  const salary = lang === 'en' && job.salaryTextEn ? job.salaryTextEn : job.salaryText;
  const isClosed = job.status === 'closed';

  return (
    <div
      onClick={() => onSelect(job)}
      className="bg-white border border-[#E8E2D5] rounded-2xl p-4 shadow-xs hover:border-[#2F5233]/60 hover:shadow-md transition-all cursor-pointer relative touch-manipulation group flex flex-col justify-between"
    >
      <div>
        {/* Top Header: Company monogram + tags + heart save button */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs font-display transition-transform group-hover:scale-105"
              style={{ backgroundColor: job.companyColor || '#2F5233' }}
            >
              {job.companyShort}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-stone-900 truncate block">
                {job.companyName}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
                <span className="font-semibold text-[#2F5233]">{job.jobType}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{job.workMode}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => onToggleSave(job.id, e)}
            className={`p-2 rounded-full border transition-colors touch-manipulation shrink-0 ${
              isSaved
                ? 'border-rose-300 bg-rose-50 text-rose-600'
                : 'border-[#E8E2D5] bg-[#FAF7F2] text-stone-600 hover:text-rose-600'
            }`}
            aria-label={isSaved ? t.saved : t.saveJob}
            title={isSaved ? 'Bỏ lưu bài đăng' : 'Lưu bài đăng yêu thích'}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-stone-900 leading-snug line-clamp-2 mb-2 group-hover:text-[#2F5233] transition-colors">
          {title}
        </h3>

        {isClosed && (
          <div className="mb-2 inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 border border-stone-300 text-[10px] font-bold text-stone-600">
            Đã ngừng tuyển dụng
          </div>
        )}

        {/* Salary & Location Row */}
        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-[#FAF7F2] border border-[#E8E2D5]/70 rounded-xl mb-2.5">
          <span className="font-bold text-[#2F5233] font-mono tabular-nums truncate pr-2">
            {salary}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-stone-600 shrink-0">
            <MapPin className="w-3 h-3 shrink-0 text-[#2F5233]" />
            <span className="truncate max-w-[110px]">{job.city}</span>
          </div>
        </div>

        {/* Skills & Match Chips */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-stone-700 mb-2.5">
          <span className="bg-[#FAF7F2] border border-[#E8E2D5] text-stone-800 px-2 py-0.5 rounded-md font-medium">
            {job.major}
          </span>
          {job.skills.slice(0, 2).map((sk) => (
            <span
              key={sk}
              className="bg-white border border-[#E8E2D5] text-stone-600 px-2 py-0.5 rounded-md"
            >
              {sk}
            </span>
          ))}
        </div>

        {/* Matching reason tag if present */}
        {matchReasons && matchReasons.length > 0 && (
          <div className="text-[10px] text-[#2F5233] font-medium mb-2.5 line-clamp-1 bg-[#EBF2EB] px-2 py-0.5 rounded-md border border-[#2F5233]/20">
            ✓ {matchReasons.join(' · ')}
          </div>
        )}
      </div>

      {/* Bottom Footer: Shifts & Posted time + Action Buttons */}
      <div className="pt-2.5 border-t border-[#E8E2D5] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-stone-600">
          <div className="flex items-center gap-1 min-w-0">
            <Clock className="w-3 h-3 shrink-0 text-stone-600" />
            <span className="truncate max-w-[150px]">
              {job.availableShifts.slice(0, 2).join(', ')}
            </span>
          </div>
          <span className="text-[10px] text-stone-500 shrink-0">{job.postedAt}</span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenMessage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMessage(job, e);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#2F5233]/30 bg-[#FAF7F2] hover:bg-[#EBF2EB] text-[#2F5233] text-[11px] font-bold transition-colors touch-manipulation"
              title="Nhắn tin với nhà tuyển dụng"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Nhắn tin</span>
            </button>
          )}

          {hasApplied ? (
            <span className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold text-[#2F5233] bg-[#EBF2EB] border border-[#2F5233]/30 px-2.5 py-2 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2F5233] shrink-0" />
              <span className="truncate">Đã ứng tuyển</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={isClosed}
              onClick={(e) => {
                e.stopPropagation();
                if (onApplyQuick) {
                  onApplyQuick(job, e);
                } else {
                  onSelect(job);
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#2F5233] hover:bg-[#244127] active:scale-95 disabled:opacity-50 text-white text-[11px] font-bold shadow-xs hover:shadow-md transition-all touch-manipulation"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Ứng tuyển ngay</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
