import { CalendarPlugin, PluginRenderContext, PluginRenderResult } from './types';

const HOLIDAYS: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '04-01': '愚人节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-25': '圣诞节',
};

const FESTIVALS: Record<string, string> = {
  '01-15': '元宵节',
  '02-02': '龙抬头',
  '05-05': '端午节',
  '07-07': '七夕节',
  '07-15': '中元节',
  '08-15': '中秋节',
  '09-09': '重阳节',
  '12-08': '腊八节',
};

function getMonthDayString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function getFestivalDate(month: number, day: number): string | null {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return FESTIVALS[key] || null;
}

export function createHolidayPlugin(): CalendarPlugin {
  return {
    name: 'holiday',
    enabled: true,
    
    renderDay(context: PluginRenderContext): PluginRenderResult {
      const monthDay = getMonthDayString(context.date);
      const holiday = HOLIDAYS[monthDay];
      
      if (holiday) {
        return {
          badge: '假',
          tooltip: holiday,
          className: 'holiday'
        };
      }
      
      const festival = getFestivalDate(context.date.getMonth() + 1, context.date.getDate());
      if (festival) {
        return {
          badge: '节',
          tooltip: festival,
          className: 'festival'
        };
      }
      
      return {};
    },
    
    renderWeekCell(context: PluginRenderContext): PluginRenderResult {
      const monthDay = getMonthDayString(context.date);
      const holiday = HOLIDAYS[monthDay];
      
      if (holiday) {
        return {
          content: holiday,
          className: 'holiday'
        };
      }
      
      const festival = getFestivalDate(context.date.getMonth() + 1, context.date.getDate());
      if (festival) {
        return {
          content: festival,
          className: 'festival'
        };
      }
      
      return {};
    }
  };
}
