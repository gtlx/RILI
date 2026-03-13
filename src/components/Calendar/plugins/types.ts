export interface CalendarPlugin {
  name: string;
  enabled: boolean;
  renderDay?(context: PluginRenderContext): PluginRenderResult;
  renderWeekCell?(context: PluginRenderContext): PluginRenderResult;
}

export interface PluginRenderContext {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface PluginRenderResult {
  className?: string;
  content?: string;
  tooltip?: string;
  badge?: string;
}

export interface PluginManager {
  register(plugin: CalendarPlugin): void;
  unregister(name: string): void;
  getEnabledPlugins(): CalendarPlugin[];
  renderDay(context: PluginRenderContext): PluginRenderResult[];
  renderWeekCell(context: PluginRenderContext): PluginRenderResult[];
}
