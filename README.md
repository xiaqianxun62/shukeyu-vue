# 数科羽 shukeyu - PC 官网 / 管理后台（Vue 3）

校园羽毛球球局系统的 **PC 官网 + 管理后台**：首页为**数据与管理型**（Hero 首屏 + 数据概览看板 + 管理功能入口 + 积分榜，不做产品功能介绍）+ 登录注册 + 个人资料 + 管理员功能页。

**技术栈：Vue 3 + Vite 5 + TypeScript（运行时零依赖，dependencies 里只有 vue）**

- 不引入 vue-router / pinia / UI 库 / CSS 框架：路由用极简 hash 切换，状态用 `ref` 单例 composable，样式用全局 CSS 变量（见 [src/styles/global.css](src/styles/global.css)）
- 动态数据（积分榜、球局列表、ELO 规则、地图）走后端真实接口；静态文案与内容卡（功能卡、加入步骤、编排方案等）定义在 [src/data/mock.ts](src/data/mock.ts)，ELO 规则接口失败时也回退到其中的 `FALLBACK_ELO_RULES`
- 首页弹窗公告（[HomeNoticeModal.vue](src/components/HomeNoticeModal.vue)）：读取管理员在 `#/notice` 配置的公告（频率/颜色/宽高/配图或视频），关闭后当天不再弹、内容更新后重新弹

## 快速启动

```bash
npm install          # 或 pnpm install（仓库同时带 package-lock.json 与 pnpm-lock.yaml）

npm run dev          # 开发：http://localhost:5174/admin/ ，/api 代理到 8080 后端
npm run build        # 类型检查（vue-tsc --noEmit）+ 产出 dist/
npm run preview      # 预览构建产物
```

前置条件：后端 [../Code](../Code) 已在 `http://localhost:8080` 启动（`vite.config.ts` 中 `server.proxy` 把 `/api` 转发过去）。

## 环境变量

在项目根目录新建 `.env` / `.env.production`（仓库已带示例）：

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | 后端地址，默认 `/api`（开发期走 vite proxy，生产由 nginx 反代） |
| `VITE_TENCENT_MAP_KEY` | 腾讯地图 JS Key（`QqMap.vue` 组件用，未配置时地图功能不可用） |
| `VITE_TIANDITU_KEY` | 天地图 Key（备用） |
| `VITE_MOBILE_URL` | 手机版站点地址覆盖（顶部「前往手机版」横幅跳转用，不填按同域推导） |

## 目录结构

```
src/
├── main.ts              # 入口：createApp(App).mount('#app')
├── App.vue              # 极简 hash 路由 + 页面切换（#hero 锚点 / #/login 等）
├── api/                 # 请求层
│   ├── http.ts          #   统一 fetch 封装：解包 ApiResponse{code,message,data}、
│   │                    #   token 注入、401 广播 yuyue:unauthorized、缩略图 URL 推导
│   ├── auth.ts / game.ts / ranking.ts / elo.ts / court.ts
│   ├── users.ts / settings.ts / verification.ts / visitLog.ts / stats.ts
├── components/          # 官网区块与通用组件
│   ├── NavHeader.vue    #   顶部固定导航（锚点滚动 + 用户菜单）
│   ├── HeroSection.vue  #   首屏 banner（保留，蒙板覆盖左半区露半个球场）
│   ├── DashboardSection.vue # 数据概览看板（指标卡 + 近7日场次 + ELO 分布）
│   ├── AdminSection.vue #   管理功能快捷入口（仅管理员可见）
│   ├── RankingSection / FooterSection / CtaToast
│   ├── AuthForm.vue / AuthModal.vue   # 登录 / 注册
│   ├── HomeNoticeModal.vue # 首页弹窗公告（仅首页挂载，按频率/版本控制弹出）
│   ├── QqMap.vue        #   腾讯地图（球场位置）
│   ├── SmartImage.vue   #   图片（自动用 _thumb.jpg 缩略图）
│   └── SvgIcon.vue      #   内联 SVG 图标（禁止 emoji / 外部图标库）
├── composables/
│   └── useAuth.ts       # 登录状态单例（localStorage: yuyue_token）
├── views/               # 独立页面（hash 路由切换）
│   ├── AuthPage.vue               # #/login #/register
│   ├── ProfilePage.vue            # #/profile  编辑个人信息
│   ├── SettingsPage.vue           # #/settings 站点文案设置（管理员）
│   ├── NoticeSettingsPage.vue     # #/notice   首页弹窗公告设置（管理员，含实时预览）
│   ├── AdminUsersPage.vue         # #/admin    用户管理（管理员）
│   ├── CourtManagementPage.vue    # #/courts   球场管理（管理员）
│   ├── QuestionManagementPage.vue # #/questions 身份校验问题管理（管理员）
│   ├── VisitLogPage.vue           # #/visitlogs 访问日志（管理员）
│   └── GameDetailPage.vue         # #/game/{id} 球局详情
├── data/mock.ts         # 演示兜底数据（ELO 规则场景等静态文案）
├── styles/global.css    # 设计系统：CSS 变量 + 全部区块样式
└── utils/               # device.ts（移动端判断）/ coord.ts / random.ts
```

## 设计规范

主题色沿用品牌视觉（球场墨绿 + 荧光黄，完整规范见 [AGENTS.md](AGENTS.md)）：

| 角色 | 色值 | 用途 |
|------|------|------|
| primary | `#14665B` | 场地墨绿：导航、标题、描边按钮 |
| accent | `#E5C84B` | 荧光黄：主 CTA、徽章、序号（占比 ≤10%） |
| bg | `#FAF7F0` | 暖白页面底 |
| text | `#1A2E2A` | 深墨绿正文 |

- 移动端优先：≤420px 单列，>420px 内容限宽 720px 居中
- 图标全部手写内联 SVG，禁止 emoji 与外部图标库
- 所有可交互元素需有 `focus-visible` 焦点环，并尊重 `prefers-reduced-motion`

## 部署

- `vite.config.ts` 中 `base: '/admin/'`：构建产物部署在站点 `/admin/` 路径下，`outDir: dist`
- 生产环境接口由 nginx 同域反代 `/api` 到后端（`.env.production` 中 `VITE_API_BASE_URL=/api`）
- `dist/` 已在 `.gitignore` 中忽略，CI/服务器上重新 `npm run build` 即可

## 相关项目

- 后端：[../Code](../Code)（Spring Boot，Swagger UI: `http://localhost:8080/api/swagger-ui.html`）
- 小程序 / H5：[../yuyue-wxapp](../yuyue-wxapp)（uni-app）
