import { CalendarPlugin, PluginManager, PluginRenderContext, PluginRenderResult } from './types';
import { createLunarPlugin, type LunarInfo } from './LunarPlugin';
import { createHolidayPlugin } from './HolidayPlugin';

class CalendarPluginManager implements PluginManager {
  private plugins: Map<string, CalendarPlugin> = new Map();
  
  constructor() {
    this.register(createLunarPlugin());
    this.register(createHolidayPlugin());
  }
  
  register(plugin: CalendarPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }
  
  unregister(name: string): void {
    this.plugins.delete(name);
  }
  
  getEnabledPlugins(): CalendarPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }
  
  setEnabled(name: string, enabled: boolean): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = enabled;
    }
  }
  
  isEnabled(name: string): boolean {
    return this.plugins.get(name)?.enabled ?? false;
  }
  
  getPlugin(name: string): CalendarPlugin | undefined {
    return this.plugins.get(name);
  }
  
  getAllPlugins(): CalendarPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  renderDay(context: PluginRenderContext): PluginRenderResult[] {
    const results: PluginRenderResult[] = [];
    
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.renderDay) {
        const result = plugin.renderDay(context);
        const items = Array.isArray(result) ? result : [result];
        for (const item of items) {
          if (item.content || item.badge || item.className) {
            results.push(item);
          }
        }
      }
    }
    
    return results;
  }
  
  renderWeekCell(context: PluginRenderContext): PluginRenderResult[] {
    const results: PluginRenderResult[] = [];
    
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.renderWeekCell) {
        const result = plugin.renderWeekCell(context);
        const items = Array.isArray(result) ? result : [result];
        for (const item of items) {
          if (item.content || item.className) {
            results.push(item);
          }
        }
      }
    }
    
    return results;
  }
}

export const pluginManager = new CalendarPluginManager();
export type { LunarInfo };
