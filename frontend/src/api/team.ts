import api from './axiosConfig';
import type { TeamMember, ActivityLogEntry, Paginated } from '../types';

export const getMembers = () => api.get<{ membres: TeamMember[]; max?: number }>('/team');

export const inviteMember = (data: { nom: string; email: string; role: 'admin' | 'collaborateur' }) =>
  api.post<{ membre: TeamMember; emailEnvoye: boolean; message: string }>('/team/inviter', data);

export const updateMemberRole = (id: string, role: 'admin' | 'collaborateur') =>
  api.put<{ membre: TeamMember }>(`/team/${id}/role`, { role });

export const removeMember = (id: string) => api.delete(`/team/${id}`);

export const getActivity = (page = 1) => api.get<Paginated<ActivityLogEntry>>('/team/activite', { params: { page } });
