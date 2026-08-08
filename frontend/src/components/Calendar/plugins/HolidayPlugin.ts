import { CalendarPlugin, PluginRenderContext, PluginRenderResult } from './types';

/**
 * 公历(阳历)固定节日表。
 * 注意:农历传统节日(春节/元宵节/端午节/中秋节等)的日期随农历浮动,
 * 不能按公历 MM-DD 匹配——它们由 LunarPlugin 基于农历日期计算,
 * 这里只保留公历固定的节日。
 */
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

function getMonthDayString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
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
          content: holiday,
          tooltip: holiday,
          className: 'holiday'
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

      return {};
    }
  };
}
