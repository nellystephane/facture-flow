import api from './axiosConfig';
import type { DashboardData } from '../types';

export const getDashboard = () => api.get<DashboardData>('/stats/dashboard');
