declare module 'lunar-calendar' {
  interface LunarData {
    zodiac: string;
    GanZhiYear: string;
    GanZhiMonth: string;
    GanZhiDay: string;
    /** 放假安排:0 无特殊安排,1 工作,2 放假 */
    worktime: number;
    /** 当日节气,无则为空字符串 */
    term: string;
    lunarYear: number;
    lunarMonth: number;
    lunarDay: number;
    /** 农历月份名,闰月带"闰"前缀(如 "闰六月") */
    lunarMonthName: string;
    lunarDayName: string;
    /** 该农历年闰几月,0 表示无闰月 */
    lunarLeapMonth: number;
    /** 公历节日 */
    solarFestival: string;
    /** 农历传统节日(春节/元宵节/端午节/中秋节/除夕 等),无则为空字符串 */
    lunarFestival: string;
  }

  interface SolarTermData {
    year: number;
    month: number;
    day: number;
    term: string;
  }

  export function solarToLunar(year: number, month: number, day: number): LunarData | null;
  export function lunarToSolar(year: number, month: number, day: number, isLeap?: boolean): { year: number, month: number, day: number } | null;
  export function getSolarTerms(year: number): SolarTermData[];
  export function getFestival(date: { month: number, day: number } | string): string | null;
}
