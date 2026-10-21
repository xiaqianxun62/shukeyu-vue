import { request, uploadFile } from './http'

/** 站点可配置文案（后端 Redis 存，零数据库依赖，GET 公开、PUT 需登录） */

export interface HomePoem {
  line1: string
  line2: string
  source: string
}

export function getHomePoem(): Promise<HomePoem> {
  return request<HomePoem>('/settings/home-poem')
}

/**
 * 修改首页诗句文案。前端只传需要改的字段（后端做 merge，空字段跳过）。
 * PUT /settings/home-poem 需要登录。
 */
export function updateHomePoem(patch: Partial<HomePoem>): Promise<HomePoem> {
  return request<HomePoem>('/settings/home-poem', {
    method: 'PUT',
    body: patch,
  })
}

/** 首页弹窗公告（enabled="1" 时展示；version 内容更新时后端自增，前端据此重新弹） */
export interface HomeNotice {
  enabled: string
  title: string
  content: string
  version: string
  /** 展示频率：always=每次进入 / daily=每天一次 / once=同一内容只弹一次 */
  frequency: string
  /** 弹窗背景色 */
  bgColor: string
  /** 标题色 */
  titleColor: string
  /** 正文色 */
  contentColor: string
  /** 按钮背景色 */
  btnBgColor: string
  /** 按钮文字色 */
  btnTextColor: string
  /** 宽度 px */
  width: string
  /** 高度 px，"0" = 高度自适应 */
  height: string
  /** 媒体类型：""=无 / image / video */
  mediaType: string
  /** 媒体地址（/uploads/xxx） */
  mediaUrl: string
}

export function getHomeNotice(): Promise<HomeNotice> {
  return request<HomeNotice>('/settings/home-notice')
}

/** 修改首页弹窗公告。前端只传需要改的字段（后端做 merge，空字段跳过）。仅管理员。 */
export function updateHomeNotice(patch: Partial<HomeNotice>): Promise<HomeNotice> {
  return request<HomeNotice>('/settings/home-notice', {
    method: 'PUT',
    body: patch,
  })
}

/** 上传公告媒体（图片/视频），返回 mediaType + mediaUrl。仅管理员。 */
export function uploadNoticeMedia(file: File): Promise<{ mediaType: string; mediaUrl: string }> {
  return uploadFile('/settings/upload-notice-media', file)
}
