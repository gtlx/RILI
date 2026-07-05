use crate::{with_db, AppState};
use rili_core::models::{MonthlyAnalysis, WeeklyAnalysis};
use tauri::State;

#[tauri::command]
pub fn get_weekly_analysis(
    state: State<AppState>,
    year: i32,
    week: u32,
) -> Result<WeeklyAnalysis, String> {
    with_db(&state, |db| db.get_weekly_analysis(year, week))
}
#[tauri::command]
pub fn get_monthly_analysis(
    state: State<AppState>,
    year: i32,
    month: u32,
) -> Result<MonthlyAnalysis, String> {
    with_db(&state, |db| db.get_monthly_analysis(year, month))
}
