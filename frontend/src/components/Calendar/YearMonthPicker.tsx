/**
 * 年月选择器:点击日历标题弹出,支持任意年/月跳转。
 * 独立组件,保持 Calendar 主文件轻量。
 */
import React, { useState } from 'react';

interface YearMonthPickerProps {
  /** 当前显示的年月(基准) */
  year: number;
  month: number;
  /** 用户选择后回调(年、月,月为 1-12) */
  onPick: (year: number, month: number) => void;
  /** 关闭浮层 */
  onClose: () => void;
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export const YearMonthPicker: React.FC<YearMonthPickerProps> = ({ year, month, onPick, onClose }) => {
  const [pickYear, setPickYear] = useState(year);

  const prevYear = () => setPickYear(y => y - 1);
  const nextYear = () => setPickYear(y => y + 1);
  const goNow = () => {
    const now = new Date();
    setPickYear(now.getFullYear());
    onPick(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <div className="ym-picker" onClick={e => e.stopPropagation()}>
      <div className="ym-picker-year">
        <button className="btn btn-icon btn-secondary" onClick={prevYear} title="上一年">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="ym-picker-year-label">{pickYear} 年</span>
        <button className="btn btn-icon btn-secondary" onClick={nextYear} title="下一年">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="ym-picker-months">
        {MONTH_NAMES.map((name, i) => {
          const m = i + 1;
          const isCurrent = m === month && pickYear === year;
          return (
            <button
              key={m}
              className={`ym-picker-month ${isCurrent ? 'active' : ''}`}
              onClick={() => onPick(pickYear, m)}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="ym-picker-footer">
        <button className="btn btn-sm btn-secondary" onClick={goNow}>回到今天</button>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>取消</button>
      </div>
    </div>
  );
};

export default YearMonthPicker;
