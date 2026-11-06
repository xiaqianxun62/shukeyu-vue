import { request } from './http'

export interface UserItem {
  id: number
  account?: string
  name: string
  nickname?: string
  gender?: number
  avatar?: string
  isVerified?: number
  rating: number
  gamesPlayed: number
  winCount: number
  lossCount: number
  createTime?: string
}

/** 角色视图：四级角色（MEMBER/OFFICER/PRESIDENT/ADMIN） */
export interface RoleItem {
  code: string
  name: string
}

/** 权限码：code 用于接口判定，name 用于展示 */
export interface PermissionItem {
  code: string
  name: string
}

/** 角色 → 权限码：分配角色前先看清「勾上这个角色到底给了什么」 */
export interface RolePermissionItem {
  code: string
  name: string
  permissions: PermissionItem[]
}

/** 角色权限矩阵（四级角色，按权限从低到高） */
export function listRolePermissions(): Promise<RolePermissionItem[]> {
  return request<RolePermissionItem[]>('/users/roles/permissions')
}

/** 列出所有用户（持 user:manage 权限） */
export function listUsers(): Promise<UserItem[]> {
  return request<UserItem[]>('/users')
}

/** 可分配的角色清单（按权限从低到高） */
export function listRoles(): Promise<RoleItem[]> {
  return request<RoleItem[]>('/users/roles')
}

/** 查某人当前角色码 */
export function getUserRoles(id: number): Promise<string[]> {
  return request<string[]>(`/users/${id}/roles`)
}

/**
 * 分配角色（整体覆盖）：不能改自己，ADMIN 仅系统管理员可授，系统至少保留一名 ADMIN。
 */
export function assignRoles(id: number, roles: string[]): Promise<string[]> {
  return request<string[]>(`/users/${id}/roles`, { method: 'PUT', body: { roles } })
}

/** 重置某账号密码为默认 123456 */
export function resetPassword(id: number): Promise<void> {
  return request<void>(`/users/${id}/reset-password`, { method: 'PUT' })
}
