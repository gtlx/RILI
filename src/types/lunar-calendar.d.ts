declare module 'lunar-calendar' {
  interface LunarData {
    lunarYear: number;
    lunarMonth: number;
    lunarDay: number;
    lunarMonthName: string;
    lunarDayName: string;
    zodiac: string;
    solarTerm: string;
    solarTerms: string[];
    isLeap: boolean;
    json: string;
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
