import type { PerformanceGradeConfig } from '@/types';

/** 默认绩效等级配置（A/B/C/D 四档） */
export const DEFAULT_GRADE_CONFIG: PerformanceGradeConfig[] = [
  { id: 'grade-a', grade_name: 'A', score_min: 90, score_max: 100, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'grade-b', grade_name: 'B', score_min: 75, score_max: 90, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'grade-c', grade_name: 'C', score_min: 60, score_max: 75, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'grade-d', grade_name: 'D', score_min: 0, score_max: 60, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

/**
 * 根据综合分与等级配置动态判定绩效等级。
 * 判定规则：综合分 >= 下限 且 综合分 < 上限；综合分 = 100 时判定为 A。
 */
export function calcLevelFromConfig(
  total: number,
  config: PerformanceGradeConfig[],
): 'A' | 'B' | 'C' | 'D' {
  if (!config.length) {
    if (total >= 90) return 'A';
    if (total >= 75) return 'B';
    if (total >= 60) return 'C';
    return 'D';
  }
  for (const g of config) {
    if (total >= g.score_min && total < g.score_max) return g.grade_name;
  }
  if (total >= 100) return 'A';
  // 兜底：取下限最低的等级
  const lowest = [...config].sort((a, b) => a.score_min - b.score_min)[0];
  return lowest ? lowest.grade_name : 'D';
}

/** 校验等级配置是否合法，返回错误信息（为空表示通过） */
export function validateGradeConfig(
  config: PerformanceGradeConfig[],
): string | null {
  const sorted = [...config].sort((a, b) => b.score_min - a.score_min);
  for (const g of config) {
    if (g.score_min < 0) return '综合分下限必须 ≥ 0';
    if (g.score_max > 100) return '综合分上限必须 ≤ 100';
    if (g.score_min >= g.score_max) return '综合分下限必须 < 综合分上限';
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (cur.score_min !== next.score_max) {
      return '相邻等级的分数区间不得重叠或留空';
    }
  }
  const d = config.find((g) => g.grade_name === 'D');
  if (d && d.score_min !== 0) return 'D 等级的综合分下限必须为 0';
  const a = config.find((g) => g.grade_name === 'A');
  if (a && a.score_max !== 100) return 'A 等级的综合分上限必须为 100';
  return null;
}