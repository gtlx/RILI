import lunarCalendar from 'lunar-calendar';
import { CalendarPlugin, PluginRenderContext, PluginRenderResult } from './types';

interface LunarInfo {
  lunarDay: number;
  lunarMonth: number;
  lunarYear: number;
  isLeap: boolean;
  lunarMonthName: string;
  lunarDayName: string;
  zodiac: string;
  solarTerm: string;
  /** 农历传统节日(由 lunar-calendar 库内置节日表返回,如 春节/元宵节/端午节/中秋节/除夕 等) */
  lunarFestival: string;
}

const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const LUNAR_DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

const ZODIAC_NAMES = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/**
 * 节日名称规范化:lunar-calendar 库内置节日表的部分名称不合传统叫法,
 * 在此统一修正(如「七夕情人节」应叫「七夕节」)。
 */
const FESTIVAL_NAME_FIX: Record<string, string> = {
  '七夕情人节': '七夕节',
};

function getLunarInfo(date: Date): LunarInfo | null {
  try {
    const lunar = lunarCalendar.solarToLunar(date.getFullYear(), date.getMonth() + 1, date.getDate()) as any;

    if (!lunar) return null;

    // 库返回的 lunarMonthName 已正确处理闰月(如 "闰六月"),直接透传即可,
    // 不要再自行拼接(原实现会把闰年所有月份都误加"闰"前缀,且闰月 indexOf 返回 -1 导致月份名为空)
    const lunarMonthName = lunar.lunarMonthName || LUNAR_MONTH_NAMES[lunar.lunarMonth] || '';
    // 当前月是否为闰月:库返回的月份名以"闰"开头即闰月
    const isLeap = lunarMonthName.startsWith('闰');
    const lunarDayName = LUNAR_DAY_NAMES[lunar.lunarDay - 1] || '';
    const zodiac = ZODIAC_NAMES[(lunar.lunarYear - 4) % 12] || '';

    return {
      lunarDay: lunar.lunarDay,
      lunarMonth: lunar.lunarMonth,
      lunarYear: lunar.lunarYear,
      isLeap,
      lunarMonthName,
      lunarDayName,
      zodiac,
      solarTerm: lunar.term || '',
      // 传统节日直接取库内置节日表结果(已验证准确:春节/元宵节/龙抬头节/端午节/七夕情人节/中元节/中秋节/重阳节/下元节/腊八节/小年/除夕);
      // 名称经 FESTIVAL_NAME_FIX 规范化(如 七夕情人节→七夕节)
      lunarFestival: FESTIVAL_NAME_FIX[lunar.lunarFestival || ''] || lunar.lunarFestival || ''
    };
  } catch {
    return null;
  }
}

export function createLunarPlugin(): CalendarPlugin {
  return {
    name: 'lunar',
    enabled: true,

    renderDay(context: PluginRenderContext): PluginRenderResult[] {
      if (!context.isCurrentMonth) {
        return [];
      }

      const lunar = getLunarInfo(context.date);
      if (!lunar) return [];

      const results: PluginRenderResult[] = [];

      // 节日当天:输出两行——第一行农历日期(如"正月初一"),第二行节日名(如"春节");
      // 避免节日名替代农历日期导致看不出是农历哪一天
      const festival = lunar.lunarFestival;
      const lunarDateName = lunar.lunarDay === 1 ? lunar.lunarMonthName : lunar.lunarDayName;

      results.push({
        content: lunarDateName,
        className: lunar.lunarDay === 1 ? 'lunar-month-start' : '',
        tooltip: `农历: ${lunar.lunarMonthName}${lunar.lunarDayName}${lunar.zodiac ? ', 生肖:' + lunar.zodiac : ''}${festival ? ', ' + festival : ''}`
      });

      if (festival) {
        results.push({
          content: festival,
          className: 'festival',
          tooltip: `农历: ${lunar.lunarMonthName}${lunar.lunarDayName}, ${festival}`
        });
      }

      if (lunar.solarTerm) {
        results.push({
          content: lunar.solarTerm,
          className: 'solar-term',
          tooltip: `节气: ${lunar.solarTerm}`
        });
      }

      return results;
    },

    renderWeekCell(context: PluginRenderContext): PluginRenderResult {
      const lunar = getLunarInfo(context.date);
      if (!lunar) return {};

      let content = '';
      // 周视图同样优先显示农历节日
      if (lunar.lunarFestival) {
        content = lunar.lunarFestival;
      } else if (lunar.lunarDay === 1) {
        content = lunar.lunarMonthName;
      } else if (lunar.solarTerm) {
        content = lunar.solarTerm;
      } else if (lunar.lunarDay <= 10) {
        content = lunar.lunarDayName;
      }

      return {
        content,
        className: lunar.lunarFestival ? 'festival' : lunar.lunarDay === 1 ? 'lunar-month-start' : ''
      };
    }
  };
}

export type { LunarInfo };
