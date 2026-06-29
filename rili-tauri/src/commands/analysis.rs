use crate::AppState;
use rili_core::models::{MonthlyAnalysis, WeeklyAnalysis};
use tauri::State;

#[tauri::command]
pub fn get_weekly_analysis(
    state: State<AppState>,
    year: i32,
    week: u32,
) -> Result<WeeklyAnalysis, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_weekly_analysis(year, week)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_monthly_analysis(
    state: State<AppState>,
    year: i32,
    month: u32,
) -> Result<MonthlyAnalysis, String> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .db
        .get_monthly_analysis(year, month)
        .map_err(|e| e.to_string())
}
