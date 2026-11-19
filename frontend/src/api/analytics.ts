import api from './axiosConfig';

export type MetricUnit = 'fcfa' | 'count';
export type GroupBy = 'day' | 'week' | 'month';
export type Period = '30j' | '90j' | '6m' | '12m' | 'annee' | 'custom';

export interface MetricInfo {
  id: string;
  label: string;
  kind: 'series' | 'breakdown';
  unit: MetricUnit;
  group: string;
  locked: boolean;
}

export interface AnalyticsCatalog {
  metrics: MetricInfo[];
  periods: Period[];
  statistiquesAvancees: boolean;
}

export interface SeriesResult {
  id: string;
  label: string;
  unit: MetricUnit;
  values: number[];
  total: number;
}

export interface BreakdownResult {
  id: string;
  label: string;
  unit: MetricUnit;
  items: { label: string; value: number }[];
  total: number;
}

export interface AnalyticsResult {
  range: { from: string; to: string; groupBy: GroupBy };
  buckets: string[];
  series: SeriesResult[];
  breakdowns: BreakdownResult[];
  verrouillees: string[];
}

export interface AnalyticsQuery {
  metrics: string[];
  period: Period;
  groupBy?: GroupBy | 'auto';
  from?: string;
  to?: string;
}

export interface AnalyticsSource {
  catalog: () => Promise<{ data: AnalyticsCatalog }>;
  query: (q: AnalyticsQuery) => Promise<{ data: AnalyticsResult }>;
}

export const getAnalyticsCatalog = () => api.get<AnalyticsCatalog>('/analytics/catalog');

export const getAnalytics = (q: AnalyticsQuery) =>
  api.get<AnalyticsResult>('/analytics', {
    params: {
      metrics: q.metrics.join(','),
      period: q.period,
      groupBy: q.groupBy && q.groupBy !== 'auto' ? q.groupBy : undefined,
      from: q.period === 'custom' ? q.from : undefined,
      to: q.period === 'custom' ? q.to : undefined,
    },
  });
