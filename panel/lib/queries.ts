'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AdminOrganization,
  api,
  Device,
  Group,
  MediaItem,
  OrganizationDetail,
  Schedule,
  Screen,
  TemplateDefinition,
  User,
} from './api';
import { useLiveInterval } from './live';
import { useRole } from './session';

/*
 * Shared data hooks. Query keys are what the live stream invalidates (lib/live.tsx),
 * so every screen using the same hook stays in sync without polling while live.
 */

export const useDevices = () =>
  useQuery({
    queryKey: ['devices'],
    queryFn: () => api<Device[]>('/devices'),
    // Last-seen times move on their own, so devices are re-read slowly even while live.
    refetchInterval: useLiveInterval(5000) === false ? 60_000 : 5000,
  });

export const useScreens = () =>
  useQuery({ queryKey: ['screens'], queryFn: () => api<Screen[]>('/screens'), refetchInterval: useLiveInterval(10_000) });

export const useTemplates = () =>
  useQuery({
    queryKey: ['templates'],
    queryFn: () => api<TemplateDefinition[]>('/screens/templates'),
    staleTime: 5 * 60_000,
  });

export const useGroups = () =>
  useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/groups'), refetchInterval: useLiveInterval(15_000) });

export const useSchedules = () =>
  useQuery({
    queryKey: ['schedules'],
    queryFn: () => api<Schedule[]>('/schedules'),
    // "active now" changes with the clock.
    refetchInterval: 30_000,
  });

export const useMedia = () =>
  useQuery({ queryKey: ['media'], queryFn: () => api<MediaItem[]>('/media'), refetchInterval: useLiveInterval(15_000) });

export const useOrganization = () =>
  useQuery({
    queryKey: ['organization'],
    queryFn: () => api<OrganizationDetail>('/organization'),
    refetchInterval: useLiveInterval(20_000),
  });

/** Platform-wide organization list (superadmin only). */
export function useAdminOrganizations() {
  const { isSuperadmin } = useRole();
  return useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => api<{ defaults: AdminOrganization['effective']; organizations: AdminOrganization[] }>('/admin/organizations'),
    enabled: isSuperadmin,
  });
}

export function useUsers() {
  const { isSuperadmin } = useRole();
  return useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users'), enabled: isSuperadmin });
}
