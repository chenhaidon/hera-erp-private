import { useAppStore } from '@/store';
import type { AppState } from '@/store';
import { Palette } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const themeOptions = [
  { value: 'warm', label: '暖棕' },
  { value: 'navy', label: '深蓝' },
  { value: 'forest', label: '墨绿' },
  { value: 'rose', label: '玫瑰' },
];

export function ThemeSwitcher() {
  const store = useAppStore();
  return (
    <Select value={store.theme} onValueChange={(v) => store.setTheme(v as AppState['theme'])}>
      <SelectTrigger className="h-8 w-auto gap-1 border-none bg-transparent px-2 text-muted-foreground hover:bg-muted">
        <Palette className="h-4 w-4 shrink-0" />
        <span className="hidden xl:inline text-xs">{themeOptions.find((t) => t.value === store.theme)?.label}</span>
      </SelectTrigger>
      <SelectContent>
        {themeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
