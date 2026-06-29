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
}

const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const LUNAR_DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

const ZODIAC_NAMES = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

function getLunarInfo(date: Date): LunarInfo | null {
  try {
    const lunar = lunarCalendar.solarToLunar(date.getFullYear(), date.getMonth() + 1, date.getDate()) as any;
    
    if (!lunar) return null;
    
    const monthNames = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
    const monthIdx = lunar.lunarMonthName ? monthNames.indexOf(lunar.lunarMonthName) + 1 : lunar.lunarMonth;
    const lunarMonthName = lunar.lunarLeapMonth > 0 ? '闰' + LUNAR_MONTH_NAMES[monthIdx] : LUNAR_MONTH_NAMES[monthIdx] || '';
    const lunarDayName = LUNAR_DAY_NAMES[lunar.lunarDay - 1] || '';
    const zodiac = ZODIAC_NAMES[(lunar.lunarYear - 4) % 12] || '';
    
    return {
      lunarDay: lunar.lunarDay,
      lunarMonth: lunar.lunarMonth,
      lunarYear: lunar.lunarYear,
      isLeap: lunar.lunarLeapMonth > 0,
      lunarMonthName,
      lunarDayName,
      zodiac,
      solarTerm: lunar.term || ''
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
      
      const lunarContent = lunar.lunarDay === 1 ? lunar.lunarMonthName : lunar.lunarDayName;
      
      const isFestival = ['春节', '元宵节', '清明节', '端午节', '中秋节', '重阳节', '除夕'].some(f => 
        lunar.lunarDayName === f || lunar.lunarMonthName + lunar.lunarDayName === f
      );
      
      results.push({
        content: lunarContent,
        className: isFestival ? 'festival' : lunar.lunarDay === 1 ? 'lunar-month-start' : '',
        tooltip: `农历: ${lunar.lunarMonthName}${lunar.lunarDayName}${lunar.zodiac ? ', 生肖:' + lunar.zodiac : ''}`
      });
      
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
      if (lunar.lunarDay === 1) {
        content = lunar.lunarMonthName;
      } else if (lunar.solarTerm) {
        content = lunar.solarTerm;
      } else if (lunar.lunarDay <= 10) {
        content = lunar.lunarDayName;
      }
      
      return {
        content,
        className: lunar.lunarDay === 1 ? 'lunar-month-start' : ''
      };
    }
  };
}

export type { LunarInfo };
