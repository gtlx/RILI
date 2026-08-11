// RILI 农历节日修复验证脚本(独立于前端,直接调用 lunar-calendar 库验证数据 + 复刻 LunarPlugin 渲染逻辑)
// 用法: node scripts/verify-lunar.mjs (放在 frontend 目录下运行)
import lunarCalendar from 'lunar-calendar';

const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const LUNAR_DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

// 复刻修复后 LunarPlugin.renderDay 的核心输出逻辑
// (含 FESTIVAL_NAME_FIX 节日名规范化,须与 LunarPlugin.ts 保持一致)
const FESTIVAL_NAME_FIX = { '七夕情人节': '七夕节' };
function pluginRenderDay(year, month, day) {
  const lunar = lunarCalendar.solarToLunar(year, month, day);
  if (!lunar) return null;
  const lunarMonthName = lunar.lunarMonthName || LUNAR_MONTH_NAMES[lunar.lunarMonth] || '';
  const lunarDayName = LUNAR_DAY_NAMES[lunar.lunarDay - 1] || '';
  const festival = FESTIVAL_NAME_FIX[lunar.lunarFestival || ''] || lunar.lunarFestival || '';
  const content = festival || (lunar.lunarDay === 1 ? lunarMonthName : lunarDayName);
  return {
    content,
    className: festival ? 'festival' : lunar.lunarDay === 1 ? 'lunar-month-start' : '',
    lunarText: `${lunarMonthName}${lunarDayName}`,
    solarTerm: lunar.term || '',
  };
}

// 期望: [公历年, 公历月, 公历日, 期望节日, 期望农历]
const cases = [
  [2026, 2, 17, '春节', '正月初一'],
  [2026, 3, 3, '元宵节', '正月十五'],
  [2026, 6, 19, '端午节', '五月初五'],
  [2026, 8, 19, '七夕节', '七月初七'],
  [2026, 8, 27, '中元节', '七月十五'],
  [2026, 9, 25, '中秋节', '八月十五'],
  [2026, 10, 18, '重阳节', '九月初九'],
  [2026, 12, 26, '', '十一月十八'], // 无节日对照日
  [2027, 2, 5, '除夕', '十二月廿九'], // 2027 除夕
  [2026, 4, 5, '', '二月十八'], // 清明是节气不是农历节日
];

let pass = 0, fail = 0;
console.log('=== 传统节日验证(2026-2027) ===');
for (const [y, m, d, expFest, expLunar] of cases) {
  const r = pluginRenderDay(y, m, d);
  const okFest = r.content === expFest || (expFest === '' && r.className !== 'festival');
  const okLunar = r.lunarText === expLunar;
  const ok = okFest && okLunar;
  ok ? pass++ : fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`.padEnd(28),
    `节日[${r.content}] 期望[${expFest || '(无)'}]`, `农历[${r.lunarText}] 期望[${expLunar}]`,
    r.solarTerm ? `节气[${r.solarTerm}]` : '',
    `class=${r.className || '(无)'}`
  );
}

// 节气验证:清明/立春/冬至
console.log('\n=== 节气验证(2026) ===');
const terms = [
  [2026, 4, 5, '清明'],
  [2026, 2, 4, '立春'],
  [2026, 12, 22, '冬至'],
];
for (const [y, m, d, exp] of terms) {
  const r = pluginRenderDay(y, m, d);
  const ok = r.solarTerm === exp;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${y}-${m}-${d} 节气[${r.solarTerm}] 期望[${exp}]`);
}

// 闰月验证:2025 闰六月 / 2023 闰二月
console.log('\n=== 闰月验证 ===');
const leaps = [
  [2025, 7, 25, '闰六月初一'], // 2025-07-25 为闰六月初一
  [2023, 3, 22, '闰二月初一'],
  [2023, 4, 20, '三月初一'],   // 闰二月之后正常三月
];
for (const [y, m, d, expLunar] of leaps) {
  const r = pluginRenderDay(y, m, d);
  const ok = r.lunarText === expLunar;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${y}-${m}-${d} 农历[${r.lunarText}] 期望[${expLunar}]`);
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
