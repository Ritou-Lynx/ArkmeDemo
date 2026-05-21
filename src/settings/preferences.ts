import React from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type AccentColor = "green" | "purple" | "blue" | "pink";
export type AppIcon = "classic" | "bright";
export type LocaleCode =
  | ""
  | "zh_CN"
  | "zh_TW"
  | "en_US"
  | "ar_SA"
  | "de_DE"
  | "es_ES"
  | "fr_FR"
  | "id_ID"
  | "it_IT"
  | "ja_JP"
  | "ko_KR"
  | "pt_BR"
  | "ru_RU"
  | "th_TH"
  | "tr_TR"
  | "vi_VN";

type PreferencesState = {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  appIcon: AppIcon;
  localeCode: LocaleCode;
};

export type TranslationKey = string;

const defaultPreferences: PreferencesState = {
  themeMode: "system",
  accentColor: "green",
  appIcon: "classic",
  localeCode: "zh_CN",
};

const storageKey = "arkme-demo.preferences";

export const supportedLocales: Array<{
  code: LocaleCode;
  displayName: string;
  locale?: string;
  dir?: "ltr" | "rtl";
}> = [
  { code: "", displayName: "自动使用系统语言" },
  { code: "zh_CN", displayName: "简体中文", locale: "zh-CN" },
  { code: "zh_TW", displayName: "繁體中文", locale: "zh-TW" },
  { code: "en_US", displayName: "English", locale: "en-US" },
  { code: "ar_SA", displayName: "العربية", locale: "ar-SA", dir: "rtl" },
  { code: "de_DE", displayName: "Deutsch", locale: "de-DE" },
  { code: "es_ES", displayName: "Español", locale: "es-ES" },
  { code: "fr_FR", displayName: "Français", locale: "fr-FR" },
  { code: "id_ID", displayName: "Bahasa Indonesia", locale: "id-ID" },
  { code: "it_IT", displayName: "Italiano", locale: "it-IT" },
  { code: "ja_JP", displayName: "日本語", locale: "ja-JP" },
  { code: "ko_KR", displayName: "한국어", locale: "ko-KR" },
  { code: "pt_BR", displayName: "Português", locale: "pt-BR" },
  { code: "ru_RU", displayName: "Русский", locale: "ru-RU" },
  { code: "th_TH", displayName: "ไทย", locale: "th-TH" },
  { code: "tr_TR", displayName: "Türkçe", locale: "tr-TR" },
  { code: "vi_VN", displayName: "Tiếng Việt", locale: "vi-VN" },
];

export const accentColorOptions: Array<{
  key: AccentColor;
  color: string;
  border: string;
}> = [
  { key: "green", color: "#09B83E", border: "rgba(136, 214, 108, 0.5)" },
  { key: "purple", color: "#8363FF", border: "rgba(131, 99, 255, 0.5)" },
  { key: "blue", color: "#0E9DEC", border: "rgba(90, 178, 255, 0.5)" },
  { key: "pink", color: "#E04DAE", border: "rgba(253, 124, 159, 0.5)" },
];

const translations: Record<string, Record<TranslationKey, string>> = {
  "zh-CN": {
    "tabs.records": "快记",
    "tabs.arrange": "\u5b89\u6392",
    "tabs.insight": "洞见",
    "tabs.mine": "我的",
    "search.close": "关闭搜索",
    "search.placeholder": "搜索快记...",
    "search.label": "搜索",
    "search.cancel": "取消",
    "search.clear": "清空搜索",
    "search.recent": "最近在搜",
    "search.quickSearch": "快速查找",
    "search.tags": "标签",
    "search.defaultTags": "#Demo,#快记,#即我,#AI",
    "search.quick.image": "图片/视频",
    "search.quick.audio": "语音",
    "search.quick.link": "外部链接",
    "search.quick.file": "文件",
    "search.quick.longArticle": "长文",
    "search.quick.contact": "联系人",
    "search.tabRecords": "快记",
    "search.tabTopics": "主题",
    "search.filter": "筛选",
    "search.noResult": "没有找到“{keyword}”相关内容\n换个关键词再试试吧",
    "search.topicCount": "{count} 条快记",
    "search.topicQuickIcon": "记",
    "drawer.closeMask": "关闭侧边栏遮罩",
    "drawer.label": "侧边栏",
    "drawer.title": "对话列表",
    "drawer.footerTitle": "候选人 Demo",
    "drawer.footerDesc": "此为即我app不带后端功能的部分前端复刻版，供候选人笔试题使用",
    "guide.title": "答题说明",
    "guide.pinned": "置顶",
    "guide.subtitle": "开始前请先阅读答题规范",
    "ai.title": "和AI编程工具对话",
    "ai.emptyTitle": "当前还没有 AI 编程对话记录",
    "ai.emptyDesc": "每次迭代后，Codex 会把输入输出同步写入这里。",
    "ai.rounds": "轮迭代记录",
    "ai.userInput": "用户输入",
    "ai.output": "AI最终输出",
    "ai.changedFiles": "本轮改动文件",
    "ai.verification": "验证结果",
    "sendToSelf.title": "发给自己",
    "sendToSelf.icon": "自",
    "sendToSelf.privateTag": "私密",
    "sendToSelf.open": "进入发给自己",
    "sendToSelf.recordCount": "条记录",
    "sendToSelf.emptyPreview": "暂无快记",
    "sendToSelf.demo1": "把今天想到的侧边栏入口先记下来：发给自己要能承接首页快记。",
    "sendToSelf.demo2": "晚点继续补一版真实使用场景，让首页和对话里的记录保持同步。",
    "homeMessagePreview.label": "新消息",
    "common.back": "返回",
    "common.done": "完成",
    "common.selected": "已选择",
    "common.vip": "会员",
    "common.openMenu": "打开侧边栏",
    "common.unreadCount": "条未读",
    "insight.title": "洞见",
    "insight.emptyTitle": "洞见自我，自在生活",
    "insight.emptyDesc": "此版块为团队内测板块，内容暂不对外开放。",
    "mine.world": "我的世界",
    "mine.user": "即我用户",
    "mine.memberTitle": "开通即我会员",
    "mine.memberDesc": "享受多种权益",
    "mine.memberAction": "立即开通",
    "mine.statsTitle": "时至今日，你用即我",
    "mine.statsButton": "统计",
    "mine.dataTitle": "数据管理",
    "mine.dataDesc": "你的数据真正属于你",
    "mine.settings": "设置",
    "mine.settingsDesc": "隐私权限管理",
    "mine.about": "关于",
    "mine.aboutDesc": "反馈建议、参加活动",
    "mine.avatarAlt": "默认头像",
    "mine.storage": "0.9G/5G",
    "mine.stat1": "持续记录 37 天",
    "mine.stat2": "在 12 个位置，产生 {count} 条快记",
    "mine.stat3": "记录总时长 426 分钟",
    "mine.stat4": "共计 {words} 字",
    "mine.tagImportExport": "导入导出",
    "mine.tagDataSecurity": "数据安全",
    "mine.tagPrivacy": "隐私保护",
    "about.userAgreement": "用户协议",
    "about.privacyTerms": "隐私条款",
    "about.privacyStatement": "隐私保护声明",
    "about.contactAuthor": "联系作者",
    "about.contactAuthorDesc": "bug反馈/功能建议/问题咨询/或...找我闲聊",
    "about.appName": "即我",
    "about.appReview": "应用评价",
    "about.appReviewTip": "好用的话烦请给个好评",
    "about.socialChannels": "公众号/小红书/抖音/即刻/微博",
    "about.wechatOfficial": "公众号",
    "about.xiaohongshu": "小红书",
    "about.douyin": "抖音",
    "about.jike": "即刻",
    "about.weibo": "微博",
    "settings.title": "设置",
    "settings.appearance": "外观样式设置",
    "settings.appearanceDesc": "主题、强调色与应用图标",
    "settings.language": "语言设置",
    "settings.languageDesc": "选择应用显示语言",
    "settings.languageSheetDesc": "选择应用显示语言",
    "settings.followSystem": "自动使用系统语言",
    "settings.current": "当前",
    "appearance.title": "外观样式设置",
    "appearance.theme": "主题模式",
    "appearance.themeSystem": "跟随系统",
    "appearance.themeLight": "浅色",
    "appearance.themeDark": "深色",
    "appearance.accent": "界面强调色",
    "appearance.icon": "应用图标",
    "appearance.freeLimit": "Demo 中保留会员条件判断：亮色应用图标为会员能力。",
    "appearance.iconClassic": "经典",
    "appearance.iconBright": "亮色",
    "accent.green": "绿色",
    "accent.purple": "紫色",
    "accent.blue": "蓝色",
    "accent.pink": "粉色",
    "composer.placeholder": "单击文字，长按语音",
    "composer.recording": "正在录音，松开发送",
    "composer.textPlaceholder": "记录此刻想法...",
    "composer.send": "发送",
    "records.demo1": "今天先把候选人笔试 Demo 搭起来，只保留移动端首页、底部导航和快记输入体验。",
    "records.demo2": "候选人可以在这个移动端基底上新增自己的模块入口、列表和详情交互。",
    "records.demo3": "视觉上沿用即我的灰白底、绿色主色、轻量圆角和底部输入框。",
    "records.voiceRecord": "语音记录 00:03",
    "records.title": "我的快记",
    "records.subtitle": "从这里开始记录想法",
    "records.noMatches": "没有匹配的快记",
    "records.emptyTitle": "记录你的每一刻",
    "records.noMatchDesc": "换一个关键词试试",
    "records.emptyDesc": "快记是你的私人记事本，随时记录想法、灵感和生活片段",
    "records.openSource": "进入对应对话",
    "recordReference.extendedFrom": "引用",
    "recordDetail.title": "快记详情",
    "recordDetail.close": "关闭详情",
    "recordDetail.untitled": "无标题",
    "recordDetail.wordUnit": "字",
    "recordDetail.wordCount": "字数",
    "recordDetail.duration": "记录时长",
    "recordDetail.review": "查阅/回顾",
    "recordDetail.share": "分享",
    "recordDetail.source": "来源",
    "recordDetail.original": "原文内容",
    "recordDetail.sourceLocation": "来源位置",
    "recordDetail.createdAt": "开始时间",
    "recordDetail.completedAt": "完成时间",
    "recordDetail.syncStatus": "同步时间",
    "recordDetail.localSynced": "本地 Demo",
    "recordDetail.quickNoteSource": "我的快记",
    "recordDetail.secondsSuffix": "s",
    "recordDetail.timesSuffix": "次",
    "recordDetail.thoughtTitle": "阿森有想法",
    "recordDetail.thoughtDesc": "这条快记可以继续延展成行动、问题或补充记忆。",
    "recordDetail.similarTitle": "相似快记",
    "recordDetail.similarDemo1": "把当前想法拆成下一步行动，方便之后继续跟进。",
    "recordDetail.similarDemo2": "围绕同一主题补充背景、决定和待确认事项。",
    "recordDetail.extendsPrefix": "共 ",
    "recordDetail.extendsSuffix": " 条延展",
    "recordDetail.noExtends": "还没有延展，继续补充评论后会显示在这里。",
    "recordDetail.extendPlaceholder": "继续延展评论...",
    "recordDetail.sendExtend": "发送",
    "recordDetail.inputMenu": "打开输入菜单",
    "recordDetail.noLocation": "暂无位置信息",
    "recordDetail.me": "我",
    "recordSnapshot.title": "记忆快照",
    "recordSnapshot.close": "关闭记忆快照",
    "recordSnapshot.untitled": "无标题",
    "recordSnapshot.quickNoteSource": "我的快记",
    "recordAction.close": "关闭操作菜单",
    "recordAction.copy": "复制",
    "recordAction.detail": "详情",
    "recordAction.fullscreen": "全屏",
    "recordAction.extend": "延展",
    "recordAction.memorySnapshot": "记忆快照",
    "recordAction.moreDetail": "查看详情",
    "recordAction.more": "更多",
    "chat.loadingMore": "加载更多...",
    "chat.loadMore": "加载更多",
    "time.today": "今天",
    "time.yesterday": "昨天",
    "time.dayBeforeYesterday": "前天",
    "time.justNow": "刚刚",
    "time.minutesAgo": "分钟前",
    "time.hoursAgo": "小时前",
    "guide.avatar": "说",
    "guide.scope": "移动端笔试规范",
    "guide.message1": "开始答题前，请先让 Codex 阅读 AGENTS.md 和 docs/candidate-rules.md，并按其中的答题规范完成后续需求。",
    "guide.message2": "每轮需求需要先理解目标和影响范围，再阅读相关代码。修改范围要聚焦，不做无关重构。",
    "guide.message3": "每完成一轮迭代，都要把时间、用户输入、AI 最终输出、改动文件和验证结果追加到自己的 docs/codex-logs/ 个人日志。",
    "guide.message4": "最终提交 GitHub 前，请运行 pnpm verify:answer，确保 lint、build、迭代日志和答题规范检查都通过。",
    "guide.message5": "面试官会结合最终代码、Git 提交历史和 Codex 迭代日志，观察你使用 AI 迭代项目的过程。",
  },
  "zh-TW": {
    "tabs.records": "快記",
    "tabs.arrange": "???",
    "tabs.insight": "洞見",
    "tabs.mine": "我的",
    "search.close": "關閉搜尋",
    "search.placeholder": "搜尋快記...",
    "search.label": "搜尋",
    "search.cancel": "取消",
    "search.clear": "清空搜尋",
    "search.recent": "最近在搜",
    "search.quickSearch": "快速查找",
    "search.tags": "標籤",
    "search.defaultTags": "#Demo,#快記,#即我,#AI",
    "search.quick.image": "圖片/影片",
    "search.quick.audio": "語音",
    "search.quick.link": "外部連結",
    "search.quick.file": "檔案",
    "search.quick.longArticle": "長文",
    "search.quick.contact": "聯絡人",
    "search.tabRecords": "快記",
    "search.tabTopics": "主題",
    "search.filter": "篩選",
    "search.noResult": "沒有找到「{keyword}」相關內容\n換個關鍵詞再試試吧",
    "search.topicCount": "{count} 條快記",
    "search.topicQuickIcon": "記",
    "drawer.closeMask": "關閉側邊欄遮罩",
    "drawer.label": "側邊欄",
    "drawer.title": "對話列表",
    "drawer.footerTitle": "候選人 Demo",
    "drawer.footerDesc": "此為即我 app 不帶後端功能的部分前端復刻版，供候選人筆試題使用",
    "guide.title": "答題說明",
    "guide.pinned": "置頂",
    "guide.subtitle": "開始前請先閱讀答題規範",
    "ai.title": "和 AI 編程工具對話",
    "ai.emptyTitle": "目前還沒有 AI 編程對話記錄",
    "ai.emptyDesc": "每次迭代後，Codex 會把輸入輸出同步寫入這裡。",
    "ai.rounds": "輪迭代記錄",
    "ai.userInput": "使用者輸入",
    "ai.output": "AI 最終輸出",
    "ai.changedFiles": "本輪改動檔案",
    "ai.verification": "驗證結果",
    "sendToSelf.title": "發給自己",
    "sendToSelf.icon": "自",
    "sendToSelf.privateTag": "私密",
    "sendToSelf.open": "進入發給自己",
    "sendToSelf.recordCount": "條記錄",
    "sendToSelf.emptyPreview": "暫無快記",
    "sendToSelf.demo1": "把今天想到的側邊欄入口先記下來：發給自己要能承接首頁快記。",
    "sendToSelf.demo2": "晚點繼續補一版真實使用場景，讓首頁和對話裡的記錄保持同步。",
    "homeMessagePreview.label": "新訊息",
    "settings.title": "設定",
    "settings.appearance": "外觀樣式設定",
    "settings.appearanceDesc": "主題、強調色與應用圖示",
    "settings.language": "語言設定",
    "settings.languageDesc": "選擇應用顯示語言",
    "settings.languageSheetDesc": "選擇應用顯示語言",
    "settings.followSystem": "自動使用系統語言",
    "settings.current": "目前",
    "appearance.title": "外觀樣式設定",
    "appearance.theme": "主題模式",
    "appearance.themeSystem": "跟隨系統",
    "appearance.themeLight": "淺色",
    "appearance.themeDark": "深色",
    "appearance.accent": "介面強調色",
    "appearance.icon": "應用圖示",
    "appearance.freeLimit": "Demo 中保留會員條件判斷：亮色應用圖示為會員能力。",
    "common.back": "返回",
    "common.done": "完成",
    "common.selected": "已選擇",
    "common.vip": "會員",
    "common.openMenu": "開啟側邊欄",
    "common.unreadCount": "則未讀",
    "insight.title": "洞見",
    "insight.emptyTitle": "洞見自我，自在生活",
    "insight.emptyDesc": "此版塊為團隊內測版塊，內容暫不對外開放。",
    "mine.world": "我的世界",
    "mine.user": "即我使用者",
    "mine.memberTitle": "開通即我會員",
    "mine.memberDesc": "享受多種權益",
    "mine.memberAction": "立即開通",
    "mine.statsTitle": "時至今日，你用即我",
    "mine.statsButton": "統計",
    "mine.dataTitle": "資料管理",
    "mine.dataDesc": "你的資料真正屬於你",
    "mine.settings": "設定",
    "mine.settingsDesc": "隱私權限管理",
    "mine.about": "關於",
    "mine.aboutDesc": "回饋建議、參加活動",
    "mine.avatarAlt": "預設頭像",
    "mine.storage": "0.9G/5G",
    "mine.stat1": "持續記錄 37 天",
    "mine.stat2": "在 12 個位置，產生 {count} 條快記",
    "mine.stat3": "記錄總時長 426 分鐘",
    "mine.stat4": "共計 {words} 字",
    "mine.tagImportExport": "匯入匯出",
    "mine.tagDataSecurity": "資料安全",
    "mine.tagPrivacy": "隱私保護",
    "about.userAgreement": "使用者協議",
    "about.privacyTerms": "隱私條款",
    "about.privacyStatement": "隱私保護聲明",
    "about.contactAuthor": "聯絡作者",
    "about.contactAuthorDesc": "bug 回饋/功能建議/問題諮詢/或...找我閒聊",
    "about.appName": "即我",
    "about.appReview": "應用評價",
    "about.appReviewTip": "好用的話煩請給個好評",
    "about.socialChannels": "公眾號/小紅書/抖音/即刻/微博",
    "about.wechatOfficial": "公眾號",
    "about.xiaohongshu": "小紅書",
    "about.douyin": "抖音",
    "about.jike": "即刻",
    "about.weibo": "微博",
    "accent.green": "綠色",
    "accent.purple": "紫色",
    "accent.blue": "藍色",
    "accent.pink": "粉色",
    "appearance.iconClassic": "經典",
    "appearance.iconBright": "亮色",
    "composer.placeholder": "單擊文字，長按語音",
    "composer.recording": "正在錄音，鬆開發送",
    "composer.textPlaceholder": "記錄此刻想法...",
    "composer.send": "發送",
    "records.demo1": "今天先把候選人筆試 Demo 搭起來，只保留行動端首頁、底部導覽和快記輸入體驗。",
    "records.demo2": "候選人可以在這個行動端基底上新增自己的模組入口、列表和詳情互動。",
    "records.demo3": "視覺上沿用即我的灰白底、綠色主色、輕量圓角和底部輸入框。",
    "records.voiceRecord": "語音記錄 00:03",
    "records.title": "我的快記",
    "records.subtitle": "從這裡開始記錄想法",
    "records.noMatches": "沒有匹配的快記",
    "records.emptyTitle": "記錄你的每一刻",
    "records.noMatchDesc": "換一個關鍵詞試試",
    "records.emptyDesc": "快記是你的私人記事本，隨時記錄想法、靈感和生活片段",
    "records.openSource": "進入對應對話",
    "recordReference.extendedFrom": "引用",
    "recordDetail.title": "快記詳情",
    "recordDetail.close": "關閉詳情",
    "recordDetail.untitled": "無標題",
    "recordDetail.wordUnit": "字",
    "recordDetail.wordCount": "字數",
    "recordDetail.duration": "記錄時長",
    "recordDetail.review": "查閱/回顧",
    "recordDetail.share": "分享",
    "recordDetail.source": "來源",
    "recordDetail.original": "原文內容",
    "recordDetail.sourceLocation": "來源位置",
    "recordDetail.createdAt": "開始時間",
    "recordDetail.completedAt": "完成時間",
    "recordDetail.syncStatus": "同步時間",
    "recordDetail.localSynced": "本地 Demo",
    "recordDetail.quickNoteSource": "我的快記",
    "recordDetail.secondsSuffix": "s",
    "recordDetail.timesSuffix": "次",
    "recordDetail.thoughtTitle": "阿森有想法",
    "recordDetail.thoughtDesc": "這條快記可以繼續延展成行動、問題或補充記憶。",
    "recordDetail.similarTitle": "相似快記",
    "recordDetail.similarDemo1": "把目前想法拆成下一步行動，方便之後繼續跟進。",
    "recordDetail.similarDemo2": "圍繞同一主題補充背景、決定和待確認事項。",
    "recordDetail.extendsPrefix": "共 ",
    "recordDetail.extendsSuffix": " 條延展",
    "recordDetail.noExtends": "還沒有延展，繼續補充評論後會顯示在這裡。",
    "recordDetail.extendPlaceholder": "繼續延展評論...",
    "recordDetail.sendExtend": "傳送",
    "recordDetail.inputMenu": "開啟輸入選單",
    "recordDetail.noLocation": "暫無位置資訊",
    "recordDetail.me": "我",
    "recordSnapshot.title": "記憶快照",
    "recordSnapshot.close": "關閉記憶快照",
    "recordSnapshot.untitled": "無標題",
    "recordSnapshot.quickNoteSource": "我的快記",
    "recordAction.close": "關閉操作選單",
    "recordAction.copy": "複製",
    "recordAction.detail": "詳情",
    "recordAction.fullscreen": "全螢幕",
    "recordAction.extend": "延展",
    "recordAction.memorySnapshot": "記憶快照",
    "recordAction.moreDetail": "查看詳情",
    "recordAction.more": "更多",
    "chat.loadingMore": "載入更多...",
    "chat.loadMore": "載入更多",
    "time.today": "今天",
    "time.yesterday": "昨天",
    "time.dayBeforeYesterday": "前天",
    "time.justNow": "剛剛",
    "time.minutesAgo": "分鐘前",
    "time.hoursAgo": "小時前",
    "guide.avatar": "說",
    "guide.scope": "行動端筆試規範",
    "guide.message1": "開始答題前，請先讓 Codex 閱讀 AGENTS.md 和 docs/candidate-rules.md，並按其中的答題規範完成後續需求。",
    "guide.message2": "每輪需求需要先理解目標和影響範圍，再閱讀相關程式碼。修改範圍要聚焦，不做無關重構。",
    "guide.message3": "每完成一輪迭代，都要把時間、使用者輸入、AI 最終輸出、改動檔案和驗證結果追加到自己的 docs/codex-logs/ 個人日誌。",
    "guide.message4": "最終提交 GitHub 前，請執行 pnpm verify:answer，確保 lint、build、迭代日誌和答題規範檢查都通過。",
    "guide.message5": "面試官會結合最終程式碼、Git 提交歷史和 Codex 迭代日誌，觀察你使用 AI 迭代專案的過程。",
  },
  "en-US": {
    "tabs.records": "Notes",
    "tabs.arrange": "Arrange",
    "tabs.insight": "Insight",
    "tabs.mine": "Me",
    "search.close": "Close search",
    "search.placeholder": "Search notes...",
    "search.label": "Search",
    "search.cancel": "Cancel",
    "search.clear": "Clear search",
    "search.recent": "Recent searches",
    "search.quickSearch": "Quick search",
    "search.tags": "Tags",
    "search.defaultTags": "#Demo,#Notes,#Jiwo,#AI",
    "search.quick.image": "Images/Videos",
    "search.quick.audio": "Voice",
    "search.quick.link": "External links",
    "search.quick.file": "Files",
    "search.quick.longArticle": "Long reads",
    "search.quick.contact": "Contacts",
    "search.tabRecords": "Notes",
    "search.tabTopics": "Topics",
    "search.filter": "Filter",
    "search.noResult": "No results for \"{keyword}\"\nTry another keyword",
    "search.topicCount": "{count} quick notes",
    "search.topicQuickIcon": "N",
    "drawer.closeMask": "Close drawer overlay",
    "drawer.label": "Sidebar",
    "drawer.title": "Conversation list",
    "drawer.footerTitle": "Candidate Demo",
    "drawer.footerDesc": "A partial frontend replica of the Jiwo app without backend features, for candidate written tests.",
    "guide.title": "Instructions",
    "guide.pinned": "Pinned",
    "guide.subtitle": "Read the answer rules first",
    "ai.title": "AI coding tool chat",
    "ai.emptyTitle": "No AI coding conversation yet",
    "ai.emptyDesc": "After each iteration, Codex writes the input and output here.",
    "ai.rounds": "iteration records",
    "ai.userInput": "User input",
    "ai.output": "AI final output",
    "ai.changedFiles": "Changed files",
    "ai.verification": "Verification",
    "sendToSelf.title": "Send to self",
    "sendToSelf.icon": "Me",
    "sendToSelf.privateTag": "Private",
    "sendToSelf.open": "Open Send to self",
    "sendToSelf.recordCount": " notes",
    "sendToSelf.emptyPreview": "No quick notes yet",
    "sendToSelf.demo1": "Save the sidebar idea here first: Send to self should collect quick notes from the home screen.",
    "sendToSelf.demo2": "Add a more realistic usage note later so home and the dedicated conversation stay in sync.",
    "homeMessagePreview.label": "New message",
    "common.back": "Back",
    "common.done": "Done",
    "common.selected": "Selected",
    "common.vip": "VIP",
    "common.openMenu": "Open sidebar",
    "common.unreadCount": " unread",
    "insight.title": "Insight",
    "insight.emptyTitle": "See yourself, live freely",
    "insight.emptyDesc": "This section is in internal team testing and is not open to the public yet.",
    "mine.world": "My World",
    "mine.user": "Jiwo User",
    "mine.memberTitle": "Activate Jiwo VIP",
    "mine.memberDesc": "Unlock more benefits",
    "mine.memberAction": "Activate",
    "mine.statsTitle": "Your Jiwo journey",
    "mine.statsButton": "Stats",
    "mine.dataTitle": "Data management",
    "mine.dataDesc": "Your data belongs to you",
    "mine.settings": "Settings",
    "mine.settingsDesc": "Privacy and permissions",
    "mine.about": "About",
    "mine.aboutDesc": "Feedback and events",
    "mine.avatarAlt": "Default avatar",
    "mine.storage": "0.9G/5G",
    "mine.stat1": "Recorded for 37 days",
    "mine.stat2": "{count} quick notes across 12 places",
    "mine.stat3": "426 minutes recorded",
    "mine.stat4": "{words} words in total",
    "mine.tagImportExport": "Import/Export",
    "mine.tagDataSecurity": "Data security",
    "mine.tagPrivacy": "Privacy",
    "about.userAgreement": "User agreement",
    "about.privacyTerms": "Privacy terms",
    "about.privacyStatement": "Privacy protection statement",
    "about.contactAuthor": "Contact author",
    "about.contactAuthorDesc": "Bug reports, feature ideas, questions, or a casual chat",
    "about.appName": "Jiwo",
    "about.appReview": "App review",
    "about.appReviewTip": "Please leave a review if it helps",
    "about.socialChannels": "WeChat/Xiaohongshu/Douyin/Jike/Weibo",
    "about.wechatOfficial": "WeChat official account",
    "about.xiaohongshu": "Xiaohongshu",
    "about.douyin": "Douyin",
    "about.jike": "Jike",
    "about.weibo": "Weibo",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.appearanceDesc": "Theme, accent color and app icon",
    "settings.language": "Language",
    "settings.languageDesc": "Choose app display language",
    "settings.languageSheetDesc": "Choose app display language",
    "settings.followSystem": "Use system language automatically",
    "settings.current": "Current",
    "appearance.title": "Appearance",
    "appearance.theme": "Theme mode",
    "appearance.themeSystem": "Follow system",
    "appearance.themeLight": "Light",
    "appearance.themeDark": "Dark",
    "appearance.accent": "Accent color",
    "appearance.icon": "App icon",
    "appearance.freeLimit": "The demo keeps VIP conditions: the bright app icon is a VIP capability.",
    "appearance.iconClassic": "Classic",
    "appearance.iconBright": "Bright",
    "accent.green": "Green",
    "accent.purple": "Purple",
    "accent.blue": "Blue",
    "accent.pink": "Pink",
    "composer.placeholder": "Tap for text, hold for voice",
    "composer.recording": "Recording, release to send",
    "composer.textPlaceholder": "Record this moment...",
    "composer.send": "Send",
    "records.demo1": "Today we are setting up the candidate exam demo with only the mobile home page, bottom tabs, and quick note input experience.",
    "records.demo2": "Candidates can add their own module entry, list, and detail interactions on top of this mobile base.",
    "records.demo3": "The visual style follows Jiwo: gray-white surfaces, green primary color, light radii, and a bottom input box.",
    "records.voiceRecord": "Voice note 00:03",
    "records.title": "My Quick Notes",
    "records.subtitle": "Start recording ideas here",
    "records.noMatches": "No matching notes",
    "records.emptyTitle": "Record every moment",
    "records.noMatchDesc": "Try another keyword",
    "records.emptyDesc": "Quick Notes is your private notebook for thoughts, ideas, and life fragments.",
    "records.openSource": "Open source conversation",
    "recordReference.extendedFrom": "Referenced note",
    "recordDetail.title": "Note details",
    "recordDetail.close": "Close details",
    "recordDetail.untitled": "Untitled",
    "recordDetail.wordUnit": " chars",
    "recordDetail.wordCount": "Words",
    "recordDetail.duration": "Duration",
    "recordDetail.review": "Views",
    "recordDetail.share": "Shares",
    "recordDetail.source": "Source",
    "recordDetail.original": "Original text",
    "recordDetail.sourceLocation": "Source",
    "recordDetail.createdAt": "Started",
    "recordDetail.completedAt": "Completed",
    "recordDetail.syncStatus": "Sync time",
    "recordDetail.localSynced": "Local demo",
    "recordDetail.quickNoteSource": "My quick notes",
    "recordDetail.secondsSuffix": "s",
    "recordDetail.timesSuffix": " times",
    "recordDetail.thoughtTitle": "Asen has thoughts",
    "recordDetail.thoughtDesc": "This note can keep expanding into actions, questions, or supporting memory.",
    "recordDetail.similarTitle": "Similar notes",
    "recordDetail.similarDemo1": "Break this idea into a next action so it is easier to follow up later.",
    "recordDetail.similarDemo2": "Add context, decisions, and open questions around the same topic.",
    "recordDetail.extendsPrefix": "",
    "recordDetail.extendsSuffix": " extensions",
    "recordDetail.noExtends": "No extensions yet. Add a comment below to continue this note.",
    "recordDetail.extendPlaceholder": "Continue with an extension...",
    "recordDetail.sendExtend": "Send",
    "recordDetail.inputMenu": "Open input menu",
    "recordDetail.noLocation": "No location info",
    "recordDetail.me": "Me",
    "recordSnapshot.title": "Memory snapshot",
    "recordSnapshot.close": "Close memory snapshot",
    "recordSnapshot.untitled": "Untitled",
    "recordSnapshot.quickNoteSource": "My quick notes",
    "recordAction.close": "Close action menu",
    "recordAction.copy": "Copy",
    "recordAction.detail": "Details",
    "recordAction.fullscreen": "Open",
    "recordAction.extend": "Extend",
    "recordAction.memorySnapshot": "Memory snapshot",
    "recordAction.moreDetail": "More details",
    "recordAction.more": "More",
    "chat.loadingMore": "Loading more...",
    "chat.loadMore": "Load more",
    "time.today": "Today",
    "time.yesterday": "Yesterday",
    "time.dayBeforeYesterday": "The day before yesterday",
    "time.justNow": "Just now",
    "time.minutesAgo": " minutes ago",
    "time.hoursAgo": " hours ago",
    "guide.avatar": "Info",
    "guide.scope": "Mobile exam rules",
    "guide.message1": "Before starting, ask Codex to read AGENTS.md and docs/candidate-rules.md, then complete the work according to those rules.",
    "guide.message2": "For each request, understand the goal and impact first, then read the related code. Keep changes focused and avoid unrelated refactors.",
    "guide.message3": "After each iteration, append the time, user input, AI final output, changed files, and verification result to your personal log under docs/codex-logs/.",
    "guide.message4": "Before submitting to GitHub, run pnpm verify:answer to ensure lint, build, iteration logs, and answer standard checks all pass.",
    "guide.message5": "The interviewer will review the final code, Git history, and Codex iteration log to understand how you used AI to iterate on the project.",
  },
  "ar-SA": {
    "tabs.records": "ملاحظات",
    "tabs.arrange": "\u062a\u0631\u062a\u064a\u0628",
    "tabs.insight": "رؤى",
    "tabs.mine": "أنا",
    "settings.title": "الإعدادات",
    "settings.appearance": "المظهر",
    "settings.language": "اللغة",
    "settings.languageDesc": "اختر لغة عرض التطبيق",
    "settings.languageSheetDesc": "اختر لغة عرض التطبيق",
    "settings.followSystem": "استخدام لغة النظام تلقائيا",
    "settings.current": "الحالي",
    "appearance.title": "المظهر",
    "appearance.theme": "نمط السمة",
    "appearance.themeSystem": "حسب النظام",
    "appearance.themeLight": "فاتح",
    "appearance.themeDark": "داكن",
    "appearance.accent": "لون التمييز",
    "appearance.icon": "أيقونة التطبيق",
    "common.back": "رجوع",
    "common.done": "تم",
    "common.selected": "محدد",
    "common.vip": "VIP",
    "composer.placeholder": "اضغط للنص، اضغط مطولا للصوت",
    "composer.recording": "جار التسجيل، اترك للإرسال",
    "composer.textPlaceholder": "سجل هذه اللحظة...",
    "composer.send": "إرسال",
  },
};


function readStoredPreferences(): PreferencesState {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return defaultPreferences;
    const parsed = JSON.parse(rawValue) as Partial<PreferencesState>;
    return {
      themeMode: isThemeMode(parsed.themeMode) ? parsed.themeMode : defaultPreferences.themeMode,
      accentColor: isAccentColor(parsed.accentColor)
        ? parsed.accentColor
        : defaultPreferences.accentColor,
      appIcon: parsed.appIcon === "bright" ? "bright" : defaultPreferences.appIcon,
      localeCode: isLocaleCode(parsed.localeCode) ? parsed.localeCode : defaultPreferences.localeCode,
    };
  } catch {
    return defaultPreferences;
  }
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isAccentColor(value: unknown): value is AccentColor {
  return value === "green" || value === "purple" || value === "blue" || value === "pink";
}

function isLocaleCode(value: unknown): value is LocaleCode {
  return supportedLocales.some((option) => option.code === value);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveLocale(localeCode: LocaleCode): string {
  if (localeCode) {
    return supportedLocales.find((option) => option.code === localeCode)?.locale ?? "zh-CN";
  }

  // Demo 默认使用简体中文，不跟随浏览器语言
  return "zh-CN";
}

function getLanguageDirection(locale: string): "ltr" | "rtl" {
  return locale.startsWith("ar") ? "rtl" : "ltr";
}

type PreferencesContextValue = PreferencesState & {
  resolvedTheme: ResolvedTheme;
  resolvedLocale: string;
  direction: "ltr" | "rtl";
  isVip: boolean;
  setThemeMode: (value: ThemeMode) => void;
  setAccentColor: (value: AccentColor) => void;
  setAppIcon: (value: AppIcon) => void;
  setLocaleCode: (value: LocaleCode) => void;
  t: (key: TranslationKey) => string;
};

const PreferencesContext = React.createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState(readStoredPreferences);
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(getSystemTheme);
  const [systemLocaleTick, setSystemLocaleTick] = React.useState(0);

  React.useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  React.useEffect(() => {
    const handleLanguageChange = () => setSystemLocaleTick((value) => value + 1);
    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  const resolvedTheme =
    preferences.themeMode === "system" ? systemTheme : preferences.themeMode;
  const resolvedLocale = React.useMemo(
    () => {
      void systemLocaleTick;
      return resolveLocale(preferences.localeCode);
    },
    [preferences.localeCode, systemLocaleTick]
  );
  const direction = getLanguageDirection(resolvedLocale);

  React.useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = preferences.accentColor;
    document.documentElement.lang = resolvedLocale;
    document.documentElement.dir = direction;
  }, [direction, preferences.accentColor, resolvedLocale, resolvedTheme]);

  const t = React.useCallback(
    (key: TranslationKey) =>
      translations[resolvedLocale]?.[key] ??
      translations[resolvedLocale.split("-")[0]]?.[key] ??
      translations["en-US"]?.[key] ??
      translations["zh-CN"][key] ??
      key,
    [resolvedLocale]
  );

  const updatePreference = React.useCallback(
    <Key extends keyof PreferencesState>(key: Key, value: PreferencesState[Key]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const value = React.useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      resolvedTheme,
      resolvedLocale,
      direction,
      isVip: false,
      setThemeMode: (themeMode) => updatePreference("themeMode", themeMode),
      setAccentColor: (accentColor) => updatePreference("accentColor", accentColor),
      setAppIcon: (appIcon) => updatePreference("appIcon", appIcon),
      setLocaleCode: (localeCode) => updatePreference("localeCode", localeCode),
      t,
    }),
    [direction, preferences, resolvedLocale, resolvedTheme, t, updatePreference]
  );

  return React.createElement(
    PreferencesContext.Provider,
    { value },
    children
  );
}

export function usePreferences() {
  const value = React.useContext(PreferencesContext);
  if (!value) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return value;
}

export function getLocaleDisplayName(localeCode: LocaleCode, resolvedLocale: string) {
  if (localeCode === "") return supportedLocales[0].displayName;
  return (
    supportedLocales.find((option) => option.code === localeCode)?.displayName ??
    resolvedLocale
  );
}
