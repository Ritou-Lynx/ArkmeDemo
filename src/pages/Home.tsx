import React from "react";
import AppShell from "@/layouts/AppShell";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import ChatList from "@/components/ChatList";
import RecordDetailSheet from "@/components/RecordDetailSheet";
import RecordFullDetailScreen from "@/components/RecordFullDetailScreen";
import Records from "@/pages/Records";
import { aiConversationLogEntries } from "@/data/aiConversationLog";
import { useCandidateProfile } from "@/data/candidateProfile";
import {
  createTestReplyMessage,
  demoSenderIdentityId,
  getInitialTestGroups,
  getInitialTestIdentities,
  getInitialTestMessages,
  getInitialTestReadState,
  getPrivateConversationId,
  persistTestMessages,
  persistTestReadState,
  testConversationStorageEvent,
  testGroupsStorageKey,
  testIdentitiesStorageKey,
  testMessagesStorageKey,
  testReadStateStorageKey,
  type TestConversationType,
  type TestGroup,
  type TestIdentity,
  type TestMessage,
  type TestReadState,
  type TestMessageSender,
} from "@/data/testConversations";
import { formatBubbleTime, formatTimeLabel } from "@/lib/time";
import {
  readLLMConfigFromStorage,
  recognizeArrangementFromQuickNoteByLLM,
  type RecognizeArrangementResult,
} from "@/lib/llm";
import { cn } from "@/lib/utils";
import {
  accentColorOptions,
  getLocaleDisplayName,
  supportedLocales,
  usePreferences,
  type AccentColor,
  type AppIcon,
  type LocaleCode,
  type ResolvedTheme,
  type ThemeMode,
} from "@/settings/preferences";
import type { PageType } from "@/App";
import type { RecordItem, RecordReference, RecordSourceConversation } from "@/types/record";

type HomeProps = {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
};

type TabItem = {
  key: PageType;
};

type ArrangementSourceContext = {
  sourceType: "quick_note";
  sourceText: string;
  createdBy: "ai" | "mock";
  createdAt: string;
  recognizeResult: RecognizeArrangementResult;
};

type ArrangeSourceContext = string | ArrangementSourceContext;

type ArrangeItem = {
  id: string;
  title: string;
  date: string;
  time?: string;
  timeText?: string;
  person?: string;
  location?: string;
  note?: string;
  sourceContext?: ArrangeSourceContext;
  completed: boolean;
  dismissed: boolean;
  completedAt?: string | null;
};

type LaterReason =
  | "user_postponed"
  | "no_time"
  | "vague_ai_created"
  | "auto_archived_overdue"
  | "ai_created_later"
  | "ai_specific_time_unresolved";

type LaterItem = {
  id: string;
  title: string;
  originalDate?: string;
  originalTime?: string;
  person?: string;
  location?: string;
  note?: string;
  sourceContext?: ArrangeSourceContext;
  laterReason: LaterReason;
  laterAt: string;
  completed: boolean;
  completedAt?: string | null;
};

type LastArrangeAction = {
  type: "delete";
  item: ArrangeItem;
  insertBeforeId: string | null;
} | {
  type: "later";
  item: ArrangeItem;
  insertBeforeId: string | null;
  laterInsertBeforeId: string | null;
} | {
  type: "return_to_arrange";
  laterItem: LaterItem;
  laterInsertBeforeId: string | null;
} | {
  type: "delete_from_later";
  laterItem: LaterItem;
  laterInsertBeforeId: string | null;
} | {
  type: "complete_from_later";
  laterItem: LaterItem;
  laterInsertBeforeId: string | null;
} | {
  type: "create_arrange";
  item: ArrangeItem;
} | {
  type: "create_later";
  laterItem: LaterItem;
} | null;

const tabs: TabItem[] = [
  { key: "records" },
  { key: "arrange" },
  { key: "insight" },
  { key: "mine" },
];

const aiConversationReadCountStorageKey = "arkme-demo.aiConversationReadCount";
const browserNotificationPromptedStorageKey = "arkme-demo.browserNotificationPrompted";
const createdSelfRecordsStorageKey = "arkme-demo.selfRecords";
const searchHistoryStorageKey = "arkme-demo.searchHistory";
const aiConversationTotalCount = aiConversationLogEntries.length;
const maxSearchHistoryCount = 4;

type QuickSearchType = "image" | "audio" | "link" | "file" | "longArticle" | "contact";

type ConversationReturnContext =
  | { mode: "drawer" }
  | {
      mode: "previous";
      recordDetail: RecordItem | null;
      recordSnapshot: RecordItem | null;
    };

type TestConversationSummary = {
  conversationId: string;
  conversationType: TestConversationType;
  title: string;
  subtitle: string;
  avatarLabel: string;
  color: string;
  identity?: TestIdentity;
  group?: TestGroup;
  memberIdentities: TestIdentity[];
  records: TestConversationRecord[];
  latestMessage: TestMessage;
  latestUnreadIdentityMessage: TestMessage | null;
  unreadCount: number;
};

type TestConversationRecord = RecordItem & {
  sender: TestMessageSender;
  identityId: string;
};

type HomeMessagePreview = {
  summary: TestConversationSummary;
  message: TestMessage;
  unreadCount: number;
};

const quickSearchTypes: QuickSearchType[] = [
  "image",
  "audio",
  "link",
  "file",
  "longArticle",
  "contact",
];

function getInitialAiConversationReadCount() {
  if (typeof window === "undefined") {
    return aiConversationTotalCount;
  }

  const storedValue = window.localStorage.getItem(aiConversationReadCountStorageKey);
  if (storedValue === null) {
    window.localStorage.setItem(
      aiConversationReadCountStorageKey,
      String(aiConversationTotalCount)
    );
    return aiConversationTotalCount;
  }

  const parsedValue = Number(storedValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(0, parsedValue), aiConversationTotalCount);
}

function normalizeStoredSelfRecord(value: unknown): RecordItem | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<RecordItem>;
  if (
    typeof record.uid !== "string" ||
    typeof record.text_content !== "string" ||
    typeof record.send_at !== "number" ||
    typeof record.create_at !== "number" ||
    typeof record.update_at !== "number" ||
    !Number.isFinite(record.send_at) ||
    !Number.isFinite(record.create_at) ||
    !Number.isFinite(record.update_at)
  ) {
    return null;
  }

  const referencedRecord = normalizeStoredRecordReference(record.referencedRecord);

  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(referencedRecord ? { referencedRecord } : {}),
  };
}

function normalizeStoredRecordReference(value: unknown): RecordReference | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<RecordReference>;
  if (
    typeof record.uid !== "string" ||
    typeof record.text_content !== "string" ||
    typeof record.send_at !== "number" ||
    typeof record.create_at !== "number" ||
    typeof record.update_at !== "number" ||
    !Number.isFinite(record.send_at) ||
    !Number.isFinite(record.create_at) ||
    !Number.isFinite(record.update_at)
  ) {
    return null;
  }

  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(record.sourceConversation ? { sourceConversation: record.sourceConversation } : {}),
  };
}

function getInitialCreatedSelfRecords() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(createdSelfRecordsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeStoredSelfRecord)
      .filter((record): record is RecordItem => Boolean(record));
  } catch {
    return [];
  }
}

function persistCreatedSelfRecords(records: RecordItem[]) {
  if (typeof window === "undefined") return;

  const storableRecords = records.map(
    ({ uid, text_content, send_at, create_at, update_at, referencedRecord }) => ({
      uid,
      text_content,
      send_at,
      create_at,
      update_at,
      ...(referencedRecord ? { referencedRecord } : {}),
    })
  );

  try {
    window.localStorage.setItem(
      createdSelfRecordsStorageKey,
      JSON.stringify(storableRecords)
    );
  } catch {
    // Storage can be unavailable in private modes; keep the in-memory record.
  }
}

function makeRecordReference(record: RecordItem): RecordReference {
  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(record.sourceConversation ? { sourceConversation: record.sourceConversation } : {}),
  };
}

function getInitialSearchHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(searchHistoryStorageKey);
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, maxSearchHistoryCount);
  } catch {
    return [];
  }
}

function persistSearchHistory(history: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(history));
  } catch {
    // Keep the visible in-memory history if storage is unavailable.
  }
}

function formatArrangeDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatArrangeTimeValue(hours: number, minutes: number) {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isClockTimeValue(value?: string | null): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function normalizeClockTime(value?: string | null) {
  return isClockTimeValue(value) ? value : undefined;
}

function getArrangeDateWithOffset(daysOffset: number, hours?: number, minutes?: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hours ?? 9, minutes ?? 0, 0, 0);
  return {
    date: formatArrangeDateValue(date),
    ...(hours !== undefined && minutes !== undefined
      ? { time: formatArrangeTimeValue(hours, minutes) }
      : {}),
  };
}

function getNextWeekdayDate(targetDay: number, hours: number, minutes: number) {
  const date = new Date();
  const currentDay = date.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  if (diff < 7) diff += 7;
  date.setDate(date.getDate() + diff);
  date.setHours(hours, minutes, 0, 0);
  return {
    date: formatArrangeDateValue(date),
    time: formatArrangeTimeValue(hours, minutes),
  };
}

function getArrangeTimestamp(item: Pick<ArrangeItem, "date" | "time">) {
  const fallbackTime = item.time ? `${item.time}:00` : "09:00:00";
  return new Date(`${item.date}T${fallbackTime}`).getTime();
}

function getArrangeDayDifference(dateValue: string, referenceDate = new Date()) {
  const target = new Date(`${dateValue}T00:00:00`);
  const reference = new Date(referenceDate);
  reference.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24));
}

function getArrangeWeekdayLabel(dateValue: string) {
  const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdayLabels[new Date(dateValue + "T00:00:00").getDay()] ?? dateValue;
}

function formatArrangeAxisPrimaryLabel(dateValue: string) {
  const date = new Date(dateValue + "T00:00:00");
  return String(date.getMonth() + 1) + "月" + String(date.getDate()) + "日";
}

function formatArrangeAxisSecondaryLabel(dateValue: string) {
  const diff = getArrangeDayDifference(dateValue);
  const weekday = getArrangeWeekdayLabel(dateValue);

  if (diff === 0) return weekday + " · 今天";
  if (diff === 1) return weekday + " · 明天";
  if (diff === -1) return weekday + " · 昨天";
  return weekday;
}

function getArrangeMetaParts(item: ArrangeItem) {
  const parts: string[] = [];
  if (item.timeText || item.time) parts.push(item.timeText ?? item.time ?? "");
  if (item.person) parts.push(item.person);
  if (item.location) parts.push(item.location);
  return parts;
}


function formatLaterOriginalDateLabel(originalDate?: string, originalTime?: string): string {
  if (!originalDate) return "无明确时间";
  const d = new Date(originalDate + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const base = month + "月" + day + "日";
  return originalTime ? base + " " + originalTime : base;
}

function getInitialLaterItems(): LaterItem[] {
  const now = new Date();
  const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
  const pastDate = (d: number) => formatArrangeDateValue(new Date(now.getTime() - d * 86400000));
  return [
    {
      id: "later-seed-1",
      title: "整理上周的工作笔记",
      originalDate: pastDate(8),
      laterReason: "user_postponed",
      laterAt: ago(1.5),
      completed: false,
      completedAt: null,
    },
    {
      id: "later-seed-2",
      title: "给张磊发邮件确认方案",
      person: "张磊",
      laterReason: "no_time",
      laterAt: ago(6),
      completed: false,
      completedAt: null,
    },
    {
      id: "later-seed-3",
      title: "看完那篇关于团队绩效的文章",
      laterReason: "vague_ai_created",
      laterAt: ago(26),
      completed: false,
      completedAt: null,
    },
  ];
}

function getInitialArrangeItems(): ArrangeItem[] {
  const threeDaysAgo = getArrangeDateWithOffset(-3);
  const yesterday = getArrangeDateWithOffset(-1);
  const todayAfternoon = getArrangeDateWithOffset(0, 14, 0);
  const todayEvening = getArrangeDateWithOffset(0, 18, 30);
  const tomorrow = getArrangeDateWithOffset(1, 10, 0);
  const nextTuesday = getNextWeekdayDate(2, 15, 0);
  const nextWednesday = getNextWeekdayDate(3, 11, 0);
  const nextThursday = getNextWeekdayDate(4, 19, 30);
  const nextMonday = getNextWeekdayDate(1, 9, 0);

  return [
    {
      id: "arrange-past-1",
      title: "上周五和王总确认预算",
      date: threeDaysAgo.date,
      person: "王总",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-past-2",
      title: "给妈妈回电话",
      date: yesterday.date,
      person: "妈妈",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-today-1",
      title: "和李泽过一遍排期草稿",
      date: todayAfternoon.date,
      time: todayAfternoon.time,
      person: "李泽",
      location: "会议室A",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-today-2",
      title: "取快递",
      date: todayEvening.date,
      time: todayEvening.time,
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-future-1",
      title: "上午给妈妈打电话",
      date: tomorrow.date,
      time: tomorrow.time,
      person: "妈妈",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-future-2",
      title: "和设计师讨论方案",
      date: nextTuesday.date,
      time: nextTuesday.time,
      person: "张磊",
      location: "3楼咖啡厅",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-future-3",
      title: "周三上午把版本风险过一遍",
      date: nextWednesday.date,
      time: nextWednesday.time,
      person: "小林",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-future-4",
      title: "周四晚上补一轮会议纪要",
      date: nextThursday.date,
      time: nextThursday.time,
      location: "家里",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
    {
      id: "arrange-future-5",
      title: "下周一上午把里程碑更新给团队",
      date: nextMonday.date,
      time: nextMonday.time,
      person: "项目组",
      completed: false,
      dismissed: false,
      completedAt: null,
    },
  ];
}

type RecognizedArrangement = {
  title: string;
  date: string;
  time?: string;
  person?: string;
  location?: string;
  isVague: boolean;
};

function recognizeArrangementFromQuickNote(text: string): RecognizedArrangement | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return null;

  const emotionOnly = /^[哈呵嘿嗯啊哦呀唉嘛吗呢吧了的啦噢哇嘻呃额嗨]+[!！。？?~～…]*$/;
  if (emotionOnly.test(trimmed)) return null;

  const chatPatterns = [
    /^(好的|嗯嗯|谢谢|没事|算了|哈哈|好吧|行吧|可以|OK|ok|拜拜|再见|晚安|早安|你好|hello|hi|hey)[!！。？?~～…]*$/i,
    /^[😀-🙏🤡-🤿🥰-🥶🦀-🦿🧀-🧿🩰-🩴🪀-🪆]+$/u,
  ];
  for (const p of chatPatterns) {
    if (p.test(trimmed)) return null;
  }

  const now = new Date();

  let dateOffset: number | null = null;
  let hours: number | undefined;
  let minutes: number | undefined;
  let explicitDate: string | undefined;
  let isVague = false;

  if (/今天/.test(trimmed)) dateOffset = 0;
  else if (/明天/.test(trimmed)) dateOffset = 1;
  else if (/后天/.test(trimmed)) dateOffset = 2;

  const monthDayMatch = /(\d{1,2})月(\d{1,2})[日号]/.exec(trimmed);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    let year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate.getTime() < now.getTime() - 86400000) year++;
    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    explicitDate = `${year}-${m}-${d}`;
    dateOffset = null;
  }

  const weekdayPatterns: Array<[RegExp, number]> = [
    [/(?:周|星期)一/, 1],
    [/(?:周|星期)二/, 2],
    [/(?:周|星期)三/, 3],
    [/(?:周|星期)四/, 4],
    [/(?:周|星期)五/, 5],
    [/(?:周|星期)六/, 6],
    [/(?:周|星期)[日天]/, 0],
  ];
  for (const [pattern, day] of weekdayPatterns) {
    if (pattern.test(trimmed) && dateOffset === null && !explicitDate) {
      const currentDay = now.getDay();
      let diff = day - currentDay;
      if (diff <= 0) diff += 7;
      dateOffset = diff;
      break;
    }
  }

  const timePointMatch = /(\d{1,2})\s*[:：点]\s*(\d{1,2})?(?:\s*分)?/.exec(trimmed);
  if (timePointMatch) {
    let h = Number(timePointMatch[1]);
    const m = timePointMatch[2] ? Number(timePointMatch[2]) : 0;
    if (/下午|晚上|晚/.test(trimmed) && h >= 1 && h <= 11) h += 12;
    if (/上午|早上|早/.test(trimmed) && h === 12) h = 0;
    hours = h;
    minutes = m;
  } else {
    if (/早上|早/.test(trimmed) && !/早安/.test(trimmed)) { hours = 8; minutes = 0; }
    else if (/上午/.test(trimmed)) { hours = 10; minutes = 0; }
    else if (/中午/.test(trimmed)) { hours = 12; minutes = 0; }
    else if (/下午/.test(trimmed)) { hours = 14; minutes = 0; }
    else if (/晚上|晚/.test(trimmed) && !/晚安/.test(trimmed)) { hours = 19; minutes = 0; }
  }

  const vaguePatterns = /有空|找时间|改天|抽空|回头|以后/;
  if (vaguePatterns.test(trimmed) && dateOffset === null && !explicitDate) {
    isVague = true;
  }

  const hasDateInfo = dateOffset !== null || explicitDate !== undefined;
  const hasTimeInfo = hours !== undefined;
  const actionPatterns = /[去做买吃喝看打发送写拿取跑走回约见交提问开带|办理|处理|整理|准备|确认|回复|联系|检查|完成|提交|汇报|报告|安排|讨论|沟通|练|学|读|听|试|修|换|洗|收|寄|借|还|挂|订|预约|签|交|缴|充|付|报名|注册|申请|面试|体检]/;
  const hasAction = actionPatterns.test(trimmed);

  if (!hasDateInfo && !hasTimeInfo && !isVague && !hasAction) return null;
  if (!hasDateInfo && !hasTimeInfo && !isVague) return null;

  let finalDate: string;
  if (explicitDate) {
    finalDate = explicitDate;
  } else if (dateOffset !== null) {
    const d = new Date(now);
    d.setDate(d.getDate() + dateOffset);
    finalDate = formatArrangeDateValue(d);
  } else if (isVague) {
    finalDate = "";
  } else if (hasTimeInfo) {
    finalDate = formatArrangeDateValue(now);
  } else {
    return null;
  }

  let person: string | undefined;
  const personMatch = /[和跟与]([^\s,，。!！?？]{1,5}?)(?:一起)?(?:吃饭|见面|开会|聊聊|聊天|讨论|商量|碰面|碰头|约|聚|通话|视频|打电话|聚餐|喝酒|喝咖啡|喝茶)/.exec(trimmed);
  if (personMatch) {
    person = personMatch[1];
  }

  let location: string | undefined;
  const locationMatch = /(?:去|到|在)([^\s,，。!！?？和跟与]{1,8}?)(?:[,，。!！?？\s]|$)/.exec(trimmed);
  if (locationMatch && !personMatch) {
    const loc = locationMatch[1];
    if (!/今天|明天|后天|下午|上午|晚上|早上|中午/.test(loc) && loc.length >= 2) {
      location = loc;
    }
  }

  let title = trimmed;
  title = title.replace(/^(今天|明天|后天)\s*/, "");
  title = title.replace(/^(上午|下午|晚上|早上|中午)\s*/, "");
  title = title.replace(/(\d{1,2})\s*[:：点]\s*(\d{1,2})?\s*(分)?\s*/, "");
  title = title.replace(/(\d{1,2})月(\d{1,2})[日号]\s*/, "");
  title = title.replace(/(?:周|星期)[一二三四五六日天]\s*/, "");
  title = title.trim();
  if (!title) title = trimmed;

  return {
    title,
    date: finalDate,
    time: hours !== undefined && minutes !== undefined ? formatArrangeTimeValue(hours, minutes) : undefined,
    person,
    location,
    isVague,
  };
}

function convertMockRecognizedArrangement(
  recognized: RecognizedArrangement
): RecognizeArrangementResult {
  const shouldCreate = Boolean(recognized.title);
  const target = recognized.isVague || !recognized.date ? "later" : "timeline";
  return {
    shouldCreate,
    confidence: recognized.isVague ? "medium" : "high",
    title: recognized.title,
    timeType: recognized.isVague ? "vague" : recognized.date ? "specific" : "none",
    date: recognized.date || null,
    timeText: recognized.time ?? null,
    person: recognized.person ?? null,
    location: recognized.location ?? null,
    note: null,
    target: shouldCreate ? target : "none",
    reason: "useMockRecognition 开启，使用本地规则识别",
  };
}

function getLaterReasonFromRecognition(result: RecognizeArrangementResult): LaterReason {
  if (result.reason === "ai_specific_time_unresolved") return "ai_specific_time_unresolved";
  if (result.timeType === "vague") return "vague_ai_created";
  if (result.timeType === "none") return "no_time";
  return "ai_created_later";
}

function isArrangementSourceContext(value: ArrangeSourceContext): value is ArrangementSourceContext {
  return typeof value !== "string";
}

function parseAiConversationTimestamp(value: string, fallbackTime: number) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return fallbackTime;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime();
}

function countRecordTextLength(value: string) {
  return Array.from(value.trim()).length;
}

function formatNumberForLocale(value: number, locale: string) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

function formatStatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function openExternalLink(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function shouldRequestBrowserNotificationPermission() {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(browserNotificationPromptedStorageKey) === "true") {
    return false;
  }
  window.localStorage.setItem(browserNotificationPromptedStorageKey, "true");
  return true;
}

export default function Home({ currentPage, onNavigate }: HomeProps) {
  const { t } = usePreferences();
  const [showSearch, setShowSearch] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showAnswerGuide, setShowAnswerGuide] = React.useState(false);
  const [showAiConversation, setShowAiConversation] = React.useState(false);
  const [showSendToSelf, setShowSendToSelf] = React.useState(false);
  const [showTestConversation, setShowTestConversation] = React.useState(false);
  const [arrangeItems, setArrangeItems] = React.useState(getInitialArrangeItems);

  const [laterItems, setLaterItems] = React.useState(getInitialLaterItems);
  const [showLaterPage, setShowLaterPage] = React.useState(false);
  const [arrangeSheetId, setArrangeSheetId] = React.useState<string | null>(null);
  const [laterSheetId, setLaterSheetId] = React.useState<string | null>(null);
  const [arrangeExpandedCompletedDates, setArrangeExpandedCompletedDates] = React.useState<string[]>([]);
  const [arrangeRecentlyCompletedIds, setArrangeRecentlyCompletedIds] = React.useState<string[]>([]);
  const [lastArrangeAction, setLastArrangeAction] = React.useState<LastArrangeAction>(null);
  const [arrangeToast, setArrangeToast] = React.useState<{ message: string; key: number } | null>(null);
  const arrangeToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conversationReturnContext, setConversationReturnContext] =
    React.useState<ConversationReturnContext>({ mode: "drawer" });
  const [aiConversationTargetIndex, setAiConversationTargetIndex] =
    React.useState<number | null>(null);
  const [sendToSelfTargetUid, setSendToSelfTargetUid] = React.useState<string | null>(null);
  const [activeTestIdentityId, setActiveTestIdentityId] = React.useState<string | null>(null);
  const [testConversationTargetUid, setTestConversationTargetUid] = React.useState<string | null>(null);
  const [settingsView, setSettingsView] = React.useState<null | "settings" | "appearance" | "about">(
    null
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchHistory, setSearchHistory] = React.useState(getInitialSearchHistory);
  const [recordDetail, setRecordDetail] = React.useState<RecordItem | null>(null);
  const [recordSnapshot, setRecordSnapshot] = React.useState<RecordItem | null>(null);
  const [lastReadAiConversationCount, setLastReadAiConversationCount] =
    React.useState(getInitialAiConversationReadCount);
  const recordsDemoBaseTime = React.useMemo(() => Date.now(), []);
  const selfDemoBaseTime = React.useMemo(() => Date.now(), []);
  const [createdSelfRecords, setCreatedSelfRecords] = React.useState(
    getInitialCreatedSelfRecords
  );
  const [testIdentities, setTestIdentities] = React.useState(getInitialTestIdentities);
  const [testGroups, setTestGroups] = React.useState(getInitialTestGroups);
  const [testMessages, setTestMessages] = React.useState(getInitialTestMessages);
  const [testReadState, setTestReadState] =
    React.useState<TestReadState>(getInitialTestReadState);
  const initializedBrowserNotificationMessagesRef = React.useRef(false);
  const browserNotifiedMessageIdsRef = React.useRef<Set<string>>(new Set());
  const previousPageRef = React.useRef<PageType>(currentPage);

  const arrangeSheetItem = React.useMemo(
    () => arrangeItems.find((item) => item.id === arrangeSheetId) ?? null,
    [arrangeSheetId, arrangeItems]
  );

  const laterSheetItem = React.useMemo(
    () => laterItems.find((item) => item.id === laterSheetId) ?? null,
    [laterSheetId, laterItems]
  );

  // 过去超过3条未完成安排：最新3条留在时间轴，更早的自动收起
  const autoArchivedPastIds = React.useMemo(() => {
    const pastIncomplete = arrangeItems
      .filter((item) => !item.completed && !item.dismissed && getArrangeDayDifference(item.date) < 0)
      .sort((a, b) => getArrangeTimestamp(b) - getArrangeTimestamp(a));
    return new Set(pastIncomplete.slice(3).map((item) => item.id));
  }, [arrangeItems]);

  // currentCompleted 传入调用方当前的 completed 值，避免依赖 updater 异步副作用
  const toggleArrangeCompleted = React.useCallback((id: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    setArrangeItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        };
      })
    );
    setArrangeRecentlyCompletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const completeArrangeToToday = React.useCallback((id: string) => {
    const today = formatArrangeDateValue(new Date());
    setArrangeItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        return { ...item, completed: true, date: today, completedAt: new Date().toISOString() };
      })
    );
    setArrangeRecentlyCompletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const showArrangeToast = React.useCallback((message: string) => {
    if (arrangeToastTimerRef.current) clearTimeout(arrangeToastTimerRef.current);
    setArrangeToast({ message, key: Date.now() });
    arrangeToastTimerRef.current = setTimeout(() => setArrangeToast(null), 4000);
  }, []);

  const dismissArrangeItemFromTimeline = React.useCallback(
    (item: ArrangeItem, insertBeforeId: string | null, type: "delete" | "later") => {
      setArrangeItems((prev) => prev.filter((it) => it.id !== item.id));
      setArrangeRecentlyCompletedIds((ids) => ids.filter((id) => id !== item.id));
      setArrangeExpandedCompletedDates((dates) => dates.filter((d) => d !== item.date));
      if (type === "later") {
        const laterItem: LaterItem = {
          id: item.id,
          title: item.title,
          originalDate: item.date,
          originalTime: item.time,
          person: item.person,
          location: item.location,
          note: item.note,
          sourceContext: item.sourceContext,
          laterReason: "user_postponed",
          laterAt: new Date().toISOString(),
          completed: false,
          completedAt: null,
        };
        setLaterItems((prev) => [laterItem, ...prev]);
        setLastArrangeAction({ type: "later", item, insertBeforeId, laterInsertBeforeId: null });
      } else {
        setLastArrangeAction({ type: "delete", item, insertBeforeId });
      }
      showArrangeToast(type === "delete" ? "已删除 · 撤销" : "以后再说 · 撤销");
    },
    [showArrangeToast]
  );

  const deleteArrangeItem = React.useCallback(
    (item: ArrangeItem, insertBeforeId: string | null) => {
      setArrangeSheetId(null);
      dismissArrangeItemFromTimeline(item, insertBeforeId, "delete");
    },
    [dismissArrangeItemFromTimeline]
  );

  const moveArrangeItemToLater = React.useCallback(
    (item: ArrangeItem, insertBeforeId: string | null) => {
      setArrangeSheetId(null);
      dismissArrangeItemFromTimeline(item, insertBeforeId, "later");
    },
    [dismissArrangeItemFromTimeline]
  );

  const deleteLaterItem = React.useCallback(
    (laterItem: LaterItem, laterInsertBeforeId: string | null) => {
      setLaterSheetId(null);
      setLaterItems((prev) => prev.filter((it) => it.id !== laterItem.id));
      setLastArrangeAction({ type: "delete_from_later", laterItem, laterInsertBeforeId });
      showArrangeToast("已删除 · 撤销");
    },
    [showArrangeToast]
  );

  const returnLaterItemToArrange = React.useCallback(
    (laterItem: LaterItem, newDate: string, newTime?: string) => {
      setLaterSheetId(null);
      setLaterItems((prev) => prev.filter((it) => it.id !== laterItem.id));
      const arrangeItem: ArrangeItem = {
        id: laterItem.id,
        title: laterItem.title,
        date: newDate,
        time: normalizeClockTime(newTime),
        timeText: newTime,
        person: laterItem.person,
        location: laterItem.location,
        note: laterItem.note,
        sourceContext: laterItem.sourceContext,
        completed: false,
        dismissed: false,
        completedAt: null,
      };
      setArrangeItems((prev) => [...prev, arrangeItem]);
      setLastArrangeAction({ type: "return_to_arrange", laterItem, laterInsertBeforeId: null });
      showArrangeToast("已放回安排 · 撤销");
    },
    [showArrangeToast]
  );

  const completeLaterItem = React.useCallback(
    (laterItem: LaterItem, laterInsertBeforeId: string | null, completeDate?: string) => {
      setLaterItems((prev) => prev.filter((it) => it.id !== laterItem.id));
      const dateToUse = completeDate ?? formatArrangeDateValue(new Date());
      const arrangeItem: ArrangeItem = {
        id: laterItem.id,
        title: laterItem.title,
        date: dateToUse,
        timeText: laterItem.originalTime,
        person: laterItem.person,
        location: laterItem.location,
        note: laterItem.note,
        sourceContext: laterItem.sourceContext,
        completed: true,
        dismissed: false,
        completedAt: new Date().toISOString(),
      };
      setArrangeItems((prev) => [...prev, arrangeItem]);
      setArrangeRecentlyCompletedIds((ids) => (ids.includes(laterItem.id) ? ids : [...ids, laterItem.id]));
      setLastArrangeAction({ type: "complete_from_later", laterItem, laterInsertBeforeId });
      showArrangeToast("已完成 · 撤销");
    },
    [showArrangeToast]
  );

  const updateLaterItem = React.useCallback((id: string, patch: Partial<LaterItem>) => {
    setLaterItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const undoLastArrangeAction = React.useCallback(() => {
    if (!lastArrangeAction) return;
    const action = lastArrangeAction;

    if (action.type === "delete" || action.type === "later") {
      setArrangeItems((prev) => {
        const id = action.insertBeforeId;
        if (!id) return [...prev, action.item];
        const idx = prev.findIndex((it) => it.id === id);
        if (idx < 0) return [...prev, action.item];
        return [...prev.slice(0, idx), action.item, ...prev.slice(idx)];
      });
      if (action.type === "later") {
        setLaterItems((prev) => prev.filter((it) => it.id !== action.item.id));
      }
    } else if (action.type === "return_to_arrange") {
      setArrangeItems((prev) => prev.filter((it) => it.id !== action.laterItem.id));
      setLaterItems((prev) => [action.laterItem, ...prev]);
    } else if (action.type === "delete_from_later") {
      setLaterItems((prev) => {
        const id = action.laterInsertBeforeId;
        if (!id) return [...prev, action.laterItem];
        const idx = prev.findIndex((it) => it.id === id);
        if (idx < 0) return [...prev, action.laterItem];
        return [...prev.slice(0, idx), action.laterItem, ...prev.slice(idx)];
      });
    } else if (action.type === "complete_from_later") {
      setArrangeItems((prev) => prev.filter((it) => it.id !== action.laterItem.id));
      setArrangeRecentlyCompletedIds((ids) => ids.filter((id) => id !== action.laterItem.id));
      setLaterItems((prev) => {
        const id = action.laterInsertBeforeId;
        if (!id) return [...prev, action.laterItem];
        const idx = prev.findIndex((it) => it.id === id);
        if (idx < 0) return [...prev, action.laterItem];
        return [...prev.slice(0, idx), action.laterItem, ...prev.slice(idx)];
      });
    } else if (action.type === "create_arrange") {
      setArrangeItems((prev) => prev.filter((it) => it.id !== action.item.id));
      setArrangeRecentlyCompletedIds((ids) => ids.filter((id) => id !== action.item.id));
    } else if (action.type === "create_later") {
      setLaterItems((prev) => prev.filter((it) => it.id !== action.laterItem.id));
    }

    setLastArrangeAction(null);
    if (arrangeToastTimerRef.current) clearTimeout(arrangeToastTimerRef.current);
    setArrangeToast(null);
  }, [lastArrangeAction]);

  const updateArrangeItem = React.useCallback((id: string, patch: Partial<ArrangeItem>) => {
    setArrangeItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  React.useEffect(() => {
    if (currentPage === "arrange" && previousPageRef.current !== "arrange") {
      setArrangeExpandedCompletedDates([]);
      setArrangeRecentlyCompletedIds([]);
    }
    if (currentPage !== "arrange" && previousPageRef.current === "arrange") {
      setArrangeRecentlyCompletedIds([]);
      setArrangeSheetId(null);
    }
    previousPageRef.current = currentPage;
  }, [currentPage]);

  const unreadAiConversationCount = Math.max(
    0,
    aiConversationTotalCount - lastReadAiConversationCount
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshTestConversations = () => {
      setTestIdentities(getInitialTestIdentities());
      setTestGroups(getInitialTestGroups());
      setTestMessages(getInitialTestMessages());
      setTestReadState(getInitialTestReadState());
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== testIdentitiesStorageKey &&
        event.key !== testGroupsStorageKey &&
        event.key !== testMessagesStorageKey &&
        event.key !== testReadStateStorageKey
      ) {
        return;
      }
      refreshTestConversations();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(testConversationStorageEvent, refreshTestConversations);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(testConversationStorageEvent, refreshTestConversations);
    };
  }, []);

  const markAiConversationAsRead = React.useCallback(() => {
    setLastReadAiConversationCount(aiConversationTotalCount);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        aiConversationReadCountStorageKey,
        String(aiConversationTotalCount)
      );
    }
  }, []);

  const makeSelfSource = React.useCallback(
    (recordUid: string): RecordSourceConversation => ({
      type: "self",
      label: t("sendToSelf.title"),
      actionLabel: t("sendToSelf.open"),
      iconLabel: t("sendToSelf.icon"),
      recordUid,
    }),
    [t]
  );

  const makeTestSource = React.useCallback(
    (
      label: string,
      iconLabel: string,
      conversationId: string,
      recordUid?: string
    ): RecordSourceConversation => ({
      type: "test",
      label,
      actionLabel: t("records.openSource"),
      iconLabel,
      conversationId,
      recordUid,
    }),
    [t]
  );

  const demoRecords = React.useMemo<RecordItem[]>(
    () => [
      {
        uid: "demo-1",
        text_content: t("records.demo1"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
        create_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
        update_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
      },
      {
        uid: "demo-2",
        text_content: t("records.demo2"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 45,
        create_at: recordsDemoBaseTime - 1000 * 60 * 45,
        update_at: recordsDemoBaseTime - 1000 * 60 * 45,
      },
      {
        uid: "demo-3",
        text_content: t("records.demo3"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 12,
        create_at: recordsDemoBaseTime - 1000 * 60 * 12,
        update_at: recordsDemoBaseTime - 1000 * 60 * 12,
      },
    ],
    [recordsDemoBaseTime, t]
  );

  const aiConversationRecords = React.useMemo<RecordItem[]>(
    () =>
      aiConversationLogEntries.map((entry, index) => {
        const timestamp = parseAiConversationTimestamp(
          entry.timestamp,
          recordsDemoBaseTime + index
        );
        return {
          uid: `ai-conversation-user-${index}`,
          text_content: entry.userInput,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
          sourceConversation: {
            type: "ai",
            label: t("ai.title"),
            actionLabel: t("records.openSource"),
            iconLabel: "AI",
            entryIndex: index,
          },
        };
      }),
    [recordsDemoBaseTime, t]
  );

  const selfDemoRecords = React.useMemo<RecordItem[]>(
    () => [
      {
        uid: "self-demo-1",
        text_content: t("sendToSelf.demo1"),
        send_at: selfDemoBaseTime - 1000 * 60 * 28,
        create_at: selfDemoBaseTime - 1000 * 60 * 28,
        update_at: selfDemoBaseTime - 1000 * 60 * 28,
        sourceConversation: makeSelfSource("self-demo-1"),
      },
      {
        uid: "self-demo-2",
        text_content: t("sendToSelf.demo2"),
        send_at: selfDemoBaseTime - 1000 * 60 * 7,
        create_at: selfDemoBaseTime - 1000 * 60 * 7,
        update_at: selfDemoBaseTime - 1000 * 60 * 7,
        sourceConversation: makeSelfSource("self-demo-2"),
      },
    ],
    [makeSelfSource, selfDemoBaseTime, t]
  );

  const selfRecords = React.useMemo(
    () =>
      [...selfDemoRecords, ...createdSelfRecords].map((record) => ({
        ...record,
        sourceConversation: makeSelfSource(record.uid),
      })),
    [createdSelfRecords, makeSelfSource, selfDemoRecords]
  );

  const testConversationRecords = React.useMemo<TestConversationRecord[]>(
    () =>
      testMessages
        .map<TestConversationRecord | null>((message) => {
          const identity = testIdentities.find((item) => item.id === message.identityId);
          const group = testGroups.find((item) => item.id === message.conversationId);
          const isGroup = message.conversationType === "group";
          const privateIdentity =
            !isGroup
              ? testIdentities.find(
                  (item) => getPrivateConversationId(item.id) === message.conversationId
                )
              : null;
          const sourceLabel = isGroup ? group?.name : privateIdentity?.name;
          const iconLabel = isGroup ? group?.avatarLabel : privateIdentity?.avatarLabel;
          if (!sourceLabel || !iconLabel) return null;
          if (message.sender === "identity" && !identity) return null;

          const uid = `test-${message.id}`;
          return {
            uid,
            text_content: message.text,
            send_at: message.sentAt,
            create_at: message.sentAt,
            update_at: message.sentAt,
            sourceConversation: makeTestSource(
              sourceLabel,
              iconLabel,
              message.conversationId,
              uid
            ),
            sender: message.sender,
            identityId: message.identityId,
          };
        })
        .filter((record): record is TestConversationRecord => Boolean(record)),
    [makeTestSource, testGroups, testIdentities, testMessages]
  );

  const testDemoReplyRecords = React.useMemo<RecordItem[]>(
    () => testConversationRecords.filter((record) => record.sender === "demo"),
    [testConversationRecords]
  );

  const testConversationSummaries = React.useMemo<TestConversationSummary[]>(
    () => {
      const privateSummaries = testIdentities
        .map<TestConversationSummary | null>((identity) => {
          const conversationId = getPrivateConversationId(identity.id);
          const records = testConversationRecords.filter(
            (record) => record.sourceConversation?.conversationId === conversationId
          );
          const messages = testMessages.filter(
            (message) => message.conversationId === conversationId
          );
          const unreadIdentityMessages = messages.filter(
            (message) =>
              message.sender === "identity" &&
              message.sentAt > (testReadState[conversationId] ?? 0)
          );
          const latestMessage = messages.reduce<TestMessage | null>(
            (latest, message) => {
              if (!latest || message.sentAt > latest.sentAt) return message;
              return latest;
            },
            null
          );
          const latestUnreadIdentityMessage =
            unreadIdentityMessages.reduce<TestMessage | null>(
              (latest, message) => {
                if (!latest || message.sentAt > latest.sentAt) return message;
                return latest;
              },
              null
            );

          if (!latestMessage) return null;

          return {
            conversationId,
            conversationType: "private",
            title: identity.name,
            subtitle: identity.note || "测试私聊",
            avatarLabel: identity.avatarLabel,
            color: identity.color,
            identity,
            memberIdentities: [identity],
            records,
            latestMessage,
            latestUnreadIdentityMessage,
            unreadCount: unreadIdentityMessages.length,
          };
        });
      const groupSummaries = testGroups
        .map<TestConversationSummary | null>((group) => {
          const memberIdentities = group.memberIdentityIds
            .map((identityId) => testIdentities.find((identity) => identity.id === identityId))
            .filter((identity): identity is TestIdentity => Boolean(identity));
          const records = testConversationRecords.filter(
            (record) => record.sourceConversation?.conversationId === group.id
          );
          const messages = testMessages.filter(
            (message) => message.conversationId === group.id
          );
          const unreadIdentityMessages = messages.filter(
            (message) =>
              message.sender === "identity" &&
              message.sentAt > (testReadState[group.id] ?? 0)
          );
          const latestMessage = messages.reduce<TestMessage | null>(
            (latest, message) => {
              if (!latest || message.sentAt > latest.sentAt) return message;
              return latest;
            },
            null
          );
          const latestUnreadIdentityMessage =
            unreadIdentityMessages.reduce<TestMessage | null>(
              (latest, message) => {
                if (!latest || message.sentAt > latest.sentAt) return message;
                return latest;
              },
              null
            );

          if (!latestMessage) {
            return {
              conversationId: group.id,
              conversationType: "group",
              title: group.name,
              subtitle: group.note || `${memberIdentities.length} 位成员`,
              avatarLabel: group.avatarLabel,
              color: group.color,
              group,
              memberIdentities,
              records,
              latestMessage: {
                id: `empty-${group.id}`,
                conversationId: group.id,
                conversationType: "group",
                identityId: demoSenderIdentityId,
                text: "群聊能力已开启，可从后台发送群消息测试。",
                sentAt: group.createdAt,
                sender: "demo",
              },
              latestUnreadIdentityMessage: null,
              unreadCount: 0,
            };
          }

          return {
            conversationId: group.id,
            conversationType: "group",
            title: group.name,
            subtitle: group.note || `${memberIdentities.length} 位成员`,
            avatarLabel: group.avatarLabel,
            color: group.color,
            group,
            memberIdentities,
            records,
            latestMessage,
            latestUnreadIdentityMessage,
            unreadCount: unreadIdentityMessages.length,
          };
        });

      return [...privateSummaries, ...groupSummaries]
        .filter((summary): summary is TestConversationSummary => Boolean(summary))
        .sort((a, b) => b.latestMessage.sentAt - a.latestMessage.sentAt);
    },
    [testConversationRecords, testGroups, testIdentities, testMessages, testReadState]
  );

  const unreadTestConversationCount = testConversationSummaries.reduce(
    (total, summary) => total + summary.unreadCount,
    0
  );
  const homeMessagePreview = React.useMemo<HomeMessagePreview | null>(
    () =>
      testConversationSummaries.reduce<HomeMessagePreview | null>(
        (latestPreview, summary) => {
          if (!summary.latestUnreadIdentityMessage) return latestPreview;
          if (
            latestPreview &&
            latestPreview.message.sentAt >= summary.latestUnreadIdentityMessage.sentAt
          ) {
            return latestPreview;
          }
          return {
            summary,
            message: summary.latestUnreadIdentityMessage,
            unreadCount: summary.unreadCount,
          };
        },
        null
      ),
    [testConversationSummaries]
  );

  const activeTestConversationSummary =
    testConversationSummaries.find(
      (summary) => summary.conversationId === activeTestIdentityId
    ) ?? null;

  const mineStatisticRecords = React.useMemo(
    () => [
      ...demoRecords,
      ...aiConversationRecords,
      ...selfRecords,
      ...testDemoReplyRecords,
    ],
    [aiConversationRecords, demoRecords, selfRecords, testDemoReplyRecords]
  );
  const recordDetailExtensionRecords = React.useMemo(
    () =>
      recordDetail
        ? mineStatisticRecords.filter(
            (record) => record.referencedRecord?.uid === recordDetail.uid
          )
        : [],
    [mineStatisticRecords, recordDetail]
  );

  const commitSearchKeyword = React.useCallback((keyword: string) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;

    setSearchHistory((prev) => {
      const nextHistory = [
        normalizedKeyword,
        ...prev.filter((value) => value !== normalizedKeyword),
      ].slice(0, maxSearchHistoryCount);
      persistSearchHistory(nextHistory);
      return nextHistory;
    });
  }, []);

  const createArrangementFromQuickNote = React.useCallback(
    async (content: string) => {
      const config = readLLMConfigFromStorage();

      if (!config.useMockRecognition) {
        const result = await recognizeArrangementFromQuickNoteByLLM(content, config);

        if (result.reason === "missing_llm_config") {
          showArrangeToast("请先配置 AI 接口");
          return;
        }
        if (result.reason === "provider_not_implemented") {
          showArrangeToast("当前 AI Provider 暂未支持");
          return;
        }
        if (result.reason === "api_request_failed") {
          showArrangeToast("识别失败，请稍后再试");
          return;
        }
        if (result.reason === "json_parse_failed") {
          showArrangeToast("AI 返回格式异常，请重试");
          return;
        }
        if (result.reason === "empty_llm_response") {
          showArrangeToast("AI 返回为空，请重试");
          return;
        }

        if (!result.shouldCreate || result.target === "none") {
          console.debug("[arrange] Quick note recognition skipped creation.", result);
          return;
        }

        const now = new Date();
        const id = `arrange-qn-${now.getTime()}`;
        const sourceContext: ArrangementSourceContext = {
          sourceType: "quick_note",
          sourceText: content,
          createdBy: "ai",
          createdAt: now.toISOString(),
          recognizeResult: result,
        };
        const title = result.title.trim() || content.trim() || "新安排";

        if (result.target === "timeline" && result.date) {
          const arrangeItem: ArrangeItem = {
            id,
            title,
            date: result.date,
            time: normalizeClockTime(result.timeText),
            timeText: result.timeText ?? undefined,
            person: result.person ?? undefined,
            location: result.location ?? undefined,
            note: result.note ?? undefined,
            sourceContext,
            completed: false,
            dismissed: false,
            completedAt: null,
          };
          setArrangeItems((prev) => [...prev, arrangeItem]);
          setLastArrangeAction({ type: "create_arrange", item: arrangeItem });
          showArrangeToast("已添加到安排 · 撤销");
          return;
        }

        const laterItem: LaterItem = {
          id,
          title,
          originalDate: result.date ?? undefined,
          originalTime: result.timeText ?? undefined,
          person: result.person ?? undefined,
          location: result.location ?? undefined,
          note: result.note ?? undefined,
          sourceContext,
          laterReason:
            result.target === "timeline" && !result.date
              ? "ai_specific_time_unresolved"
              : getLaterReasonFromRecognition(result),
          laterAt: now.toISOString(),
          completed: false,
          completedAt: null,
        };
        setLaterItems((prev) => [laterItem, ...prev]);
        setLastArrangeAction({ type: "create_later", laterItem });
        showArrangeToast("已放入以后再说 · 撤销");
        return;
      }

      const recognized = recognizeArrangementFromQuickNote(content);
      if (!recognized) return;

      const now = new Date();
      const result = convertMockRecognizedArrangement(recognized);
      const id = `arrange-qn-${now.getTime()}`;
      const sourceContext: ArrangementSourceContext = {
        sourceType: "quick_note",
        sourceText: content,
        createdBy: "mock",
        createdAt: now.toISOString(),
        recognizeResult: result,
      };

      if (recognized.isVague || !recognized.date) {
        const laterItem: LaterItem = {
          id,
          title: recognized.title,
          person: recognized.person,
          location: recognized.location,
          sourceContext,
          laterReason: "vague_ai_created",
          laterAt: now.toISOString(),
          completed: false,
          completedAt: null,
        };
        setLaterItems((prev) => [laterItem, ...prev]);
        showArrangeToast("已识别为安排 → 以后再说");
        return;
      }

      const arrangeItem: ArrangeItem = {
        id,
        title: recognized.title,
        date: recognized.date,
        time: recognized.time,
        timeText: recognized.time,
        person: recognized.person,
        location: recognized.location,
        sourceContext,
        completed: false,
        dismissed: false,
        completedAt: null,
      };
      setArrangeItems((prev) => [...prev, arrangeItem]);
      setLastArrangeAction({ type: "create_arrange", item: arrangeItem });
      showArrangeToast("已识别为安排 → 时间轴");
    },
    [showArrangeToast]
  );

  const createSelfRecord = React.useCallback((content: string) => {
    const timestamp = Date.now();
    setCreatedSelfRecords((prev) => {
      const nextRecords = [
        ...prev,
        {
          uid: `self-${timestamp}`,
          text_content: content,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
        },
      ];
      persistCreatedSelfRecords(nextRecords);
      return nextRecords;
    });
    void createArrangementFromQuickNote(content);
  }, [createArrangementFromQuickNote]);

  const createRecordExtension = React.useCallback((parentRecord: RecordItem, content: string) => {
    const timestamp = Date.now();
    setCreatedSelfRecords((prev) => {
      const nextRecords = [
        ...prev,
        {
          uid: `self-extension-${timestamp}`,
          text_content: content,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
          referencedRecord: makeRecordReference(parentRecord),
        },
      ];
      persistCreatedSelfRecords(nextRecords);
      return nextRecords;
    });
  }, []);

  const backToDrawer = () => {
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setShowMenu(true);
    setConversationReturnContext({ mode: "drawer" });
  };

  const backToPreviousConversationOrigin = () => {
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setShowMenu(false);

    if (conversationReturnContext.mode === "previous") {
      setRecordDetail(conversationReturnContext.recordDetail);
      setRecordSnapshot(conversationReturnContext.recordSnapshot);
    }

    setConversationReturnContext({ mode: "drawer" });
  };

  const handleConversationBack = () => {
    if (conversationReturnContext.mode === "drawer") {
      backToDrawer();
      return;
    }

    backToPreviousConversationOrigin();
  };

  const openAiConversation = React.useCallback(
    (
      targetIndex: number | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      markAiConversationAsRead();
      setConversationReturnContext(returnContext);
      setAiConversationTargetIndex(targetIndex);
      setShowMenu(false);
      setShowSendToSelf(false);
      setShowTestConversation(false);
      setShowAiConversation(true);
    },
    [markAiConversationAsRead]
  );

  const openSendToSelf = React.useCallback(
    (
      targetUid: string | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      setConversationReturnContext(returnContext);
      setShowMenu(false);
      setSendToSelfTargetUid(targetUid);
      setShowAiConversation(false);
      setShowTestConversation(false);
      setShowSendToSelf(true);
    },
    []
  );

  const markTestConversationAsRead = React.useCallback(
    (conversationId: string) => {
      const latestMessageTime = testMessages.reduce((latest, message) => {
        if (message.conversationId !== conversationId) return latest;
        return Math.max(latest, message.sentAt);
      }, 0);

      setTestReadState((prev) => {
        const nextReadState = {
          ...prev,
          [conversationId]: latestMessageTime || Date.now(),
        };
        persistTestReadState(nextReadState);
        return nextReadState;
      });
    },
    [testMessages]
  );

  const openTestConversation = React.useCallback(
    (
      conversationId: string,
      targetUid: string | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      markTestConversationAsRead(conversationId);
      setConversationReturnContext(returnContext);
      setActiveTestIdentityId(conversationId);
      setTestConversationTargetUid(targetUid);
      setShowMenu(false);
      setShowAiConversation(false);
      setShowSendToSelf(false);
      setShowTestConversation(true);
    },
    [markTestConversationAsRead]
  );

  const returnToHomeFromNotification = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.focus();
    }

    setShowSearch(false);
    setShowMenu(false);
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setConversationReturnContext({ mode: "drawer" });
    setAiConversationTargetIndex(null);
    setSendToSelfTargetUid(null);
    setActiveTestIdentityId(null);
    setTestConversationTargetUid(null);
    setSettingsView(null);
    setRecordDetail(null);
    setRecordSnapshot(null);
    onNavigate("records");
  }, [onNavigate]);

  const showBrowserMessageNotification = React.useCallback(
    (summary: TestConversationSummary, message: TestMessage) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;

      const showNotification = () => {
        const notification = new Notification(summary.title, {
          body: message.text,
          icon: "/images/logo-jiwo-green.svg",
          tag: `arkme-demo-message-${message.id}`,
        });
        notification.onclick = () => {
          notification.close();
          returnToHomeFromNotification();
        };
      };

      if (Notification.permission === "granted") {
        showNotification();
        return;
      }

      if (
        Notification.permission === "default" &&
        shouldRequestBrowserNotificationPermission()
      ) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            showNotification();
          }
        });
      }
    },
    [returnToHomeFromNotification]
  );

  React.useEffect(() => {
    if (!showTestConversation || !activeTestIdentityId) return;
    markTestConversationAsRead(activeTestIdentityId);
  }, [
    activeTestIdentityId,
    markTestConversationAsRead,
    showTestConversation,
    testMessages.length,
  ]);

  React.useEffect(() => {
    const identityMessages = testMessages.filter(
      (message) => message.sender === "identity"
    );

    if (!initializedBrowserNotificationMessagesRef.current) {
      identityMessages.forEach((message) => {
        browserNotifiedMessageIdsRef.current.add(message.id);
      });
      initializedBrowserNotificationMessagesRef.current = true;
      return;
    }

    const newIdentityMessages = identityMessages.filter(
      (message) => !browserNotifiedMessageIdsRef.current.has(message.id)
    );
    if (newIdentityMessages.length === 0) return;

    newIdentityMessages.forEach((message) => {
      browserNotifiedMessageIdsRef.current.add(message.id);
    });

    const latestMessage = newIdentityMessages.reduce((latest, message) =>
      message.sentAt > latest.sentAt ? message : latest
    );
    if (
      showTestConversation &&
      activeTestIdentityId === latestMessage.conversationId
    ) {
      return;
    }

    const summary = testConversationSummaries.find(
      (item) => item.conversationId === latestMessage.conversationId
    );
    if (!summary) return;

    showBrowserMessageNotification(summary, latestMessage);
  }, [
    activeTestIdentityId,
    showBrowserMessageNotification,
    showTestConversation,
    testConversationSummaries,
    testMessages,
  ]);

  const openHomeMessagePreview = React.useCallback(() => {
    if (!homeMessagePreview) return;

    const returnContext: ConversationReturnContext = {
      mode: "previous",
      recordDetail: null,
      recordSnapshot: null,
    };
    openTestConversation(
      homeMessagePreview.summary.conversationId,
      `test-${homeMessagePreview.message.id}`,
      returnContext
    );
  }, [homeMessagePreview, openTestConversation]);

  const createTestReply = React.useCallback((summary: TestConversationSummary, content: string) => {
    const reply = createTestReplyMessage(
      summary.conversationId,
      content,
      summary.conversationType
    );
    setTestMessages((prev) => {
      const nextMessages = [...prev, reply];
      persistTestMessages(nextMessages);
      return nextMessages;
    });
    markTestConversationAsRead(summary.conversationId);
    setTestConversationTargetUid(`test-${reply.id}`);
  }, [markTestConversationAsRead]);

  const openSourceConversation = React.useCallback(
    (source: RecordSourceConversation) => {
      const returnContext: ConversationReturnContext = {
        mode: "previous",
        recordDetail,
        recordSnapshot,
      };

      setRecordDetail(null);
      setRecordSnapshot(null);

      if (source.type === "ai" && typeof source.entryIndex === "number") {
        openAiConversation(source.entryIndex, returnContext);
        return;
      }

      if (source.type === "test" && source.conversationId) {
        openTestConversation(source.conversationId, source.recordUid ?? null, returnContext);
        return;
      }

      openSendToSelf(source.recordUid ?? null, returnContext);
    },
    [
      openAiConversation,
      openSendToSelf,
      openTestConversation,
      recordDetail,
      recordSnapshot,
    ]
  );

  const renderMainContent = () => {
    if (recordDetail) {
      return (
        <RecordFullDetailScreen
          record={recordDetail}
          extensionRecords={recordDetailExtensionRecords}
          onBack={() => setRecordDetail(null)}
          onCreateExtension={createRecordExtension}
          onOpenSource={openSourceConversation}
        />
      );
    }

    if (settingsView === "appearance") {
      return <AppearanceStyleScreen onBack={() => setSettingsView("settings")} />;
    }

    if (settingsView === "about") {
      return <AboutScreen onBack={() => setSettingsView(null)} />;
    }

    if (settingsView === "settings") {
      return (
        <SettingsScreen
          onBack={() => setSettingsView(null)}
          onOpenAppearance={() => setSettingsView("appearance")}
        />
      );
    }

    if (showAiConversation) {
      return (
        <AiToolConversationChat
          onBack={handleConversationBack}
          targetIndex={aiConversationTargetIndex}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      );
    }

    if (showSendToSelf) {
      return (
        <SendToSelfConversationChat
          records={selfRecords}
          targetUid={sendToSelfTargetUid}
          onBack={handleConversationBack}
          onCreateRecord={createSelfRecord}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      );
    }

    if (showTestConversation && activeTestConversationSummary) {
      return (
        <TestIdentityConversationChat
          summary={activeTestConversationSummary}
          targetUid={testConversationTargetUid}
          onBack={handleConversationBack}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
          onCreateReply={(content) => createTestReply(activeTestConversationSummary, content)}
        />
      );
    }

    if (showAnswerGuide) {
      return <AnswerGuideChat onBack={backToDrawer} />;
    }

    if (showSearch) {
      return (
        <SearchScreen
          searchQuery={searchQuery}
          searchHistory={searchHistory}
          records={mineStatisticRecords}
          onChangeSearchQuery={setSearchQuery}
          onCommitSearch={commitSearchKeyword}
          onClose={() => {
            commitSearchKeyword(searchQuery);
            setShowSearch(false);
          }}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
          onOpenSourceConversation={openSourceConversation}
        />
      );
    }

    if (currentPage === "mine") {
      return (
        <MinePreview
          records={mineStatisticRecords}
          onOpenSettings={() => setSettingsView("settings")}
          onOpenAbout={() => setSettingsView("about")}
        />
      );
    }

    if (currentPage === "arrange") {
      const toastNode = arrangeToast ? (
        <ArrangeToast
          key={arrangeToast.key}
          message={arrangeToast.message}
          onUndo={undoLastArrangeAction}
          onDismiss={() => {
            if (arrangeToastTimerRef.current) clearTimeout(arrangeToastTimerRef.current);
            setArrangeToast(null);
          }}
        />
      ) : null;

      return (
        <div className="relative flex h-full flex-col overflow-hidden">
          {/* ── 共享 Tab 栏：始终静止，不参与滑动 ── */}
          <header className="flex h-12 shrink-0 items-center justify-center bg-[linear-gradient(180deg,var(--primary-soft)_0%,var(--primary-soft)_100%)] px-4">
            <div className="flex items-center gap-0.5 rounded-full bg-black/[0.06] p-1 dark:bg-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowLaterPage(false)}
                className={
                  !showLaterPage
                    ? "rounded-full bg-bg px-4 py-1.5 text-[13px] font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.10)] transition-all"
                    : "rounded-full px-4 py-1.5 text-[13px] font-medium text-text-muted transition-all active:opacity-70"
                }
              >
                {"时间轴"}
              </button>
              <button
                type="button"
                onClick={() => setShowLaterPage(true)}
                className={
                  showLaterPage
                    ? "rounded-full bg-bg px-4 py-1.5 text-[13px] font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.10)] transition-all"
                    : "rounded-full px-4 py-1.5 text-[13px] font-medium text-text-muted transition-all active:opacity-70"
                }
              >
                {"以后再说"}
              </button>
              <button
                type="button"
                disabled
                className="cursor-default rounded-full px-4 py-1.5 text-[13px] font-medium text-text-muted/35"
              >
                {"日历"}
              </button>
            </div>
          </header>

          {/* ── 内容区：仅此部分平移 ── */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="flex h-full transition-transform duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                width: "200%",
                transform: showLaterPage ? "translateX(-50%)" : "translateX(0)",
              }}
            >
              {/* 时间轴面板 */}
              <div className="h-full overflow-hidden" style={{ width: "50%" }}>
                <ArrangePreview
                  items={arrangeItems}
                  autoArchivedPastIds={autoArchivedPastIds}
                  expandedCompletedDates={arrangeExpandedCompletedDates}
                  recentlyCompletedIds={arrangeRecentlyCompletedIds}
                  onToggleCompleted={toggleArrangeCompleted}
                  onCompleteToday={completeArrangeToToday}
                  onDelete={deleteArrangeItem}
                  onLater={moveArrangeItemToLater}
                  onOpenSheet={setArrangeSheetId}
                  onToggleCompletedDate={(date) =>
                    setArrangeExpandedCompletedDates((dates) =>
                      dates.includes(date)
                        ? dates.filter((itemDate) => itemDate !== date)
                        : [...dates, date]
                    )
                  }
                  onReleaseRecentlyCompleted={(id) =>
                    setArrangeRecentlyCompletedIds((ids) => ids.filter((itemId) => itemId !== id))
                  }
                />
              </div>

              {/* 以后再说面板 */}
              <div className="h-full overflow-hidden" style={{ width: "50%" }}>
                <LaterPage
                  items={laterItems}
                  onOpenSheet={(id) => setLaterSheetId(id)}
                  onDelete={(item, insertBeforeId) => deleteLaterItem(item, insertBeforeId)}
                  onReturnToArrange={(item, date, time) => returnLaterItemToArrange(item, date, time)}
                  onComplete={(item, insertBeforeId, completeDate) => completeLaterItem(item, insertBeforeId, completeDate)}
                />
              </div>
            </div>
          </div>

          {/* ── 弹窗与 toast：在轮播层之外，覆盖全屏 ── */}
          {arrangeSheetItem && (
            <ArrangeBottomSheet
              item={arrangeSheetItem}
              onChange={(patch) => updateArrangeItem(arrangeSheetItem.id, patch)}
              onClose={() => setArrangeSheetId(null)}
              onDelete={() => deleteArrangeItem(arrangeSheetItem, null)}
              onLater={() => moveArrangeItemToLater(arrangeSheetItem, null)}
            />
          )}
          {laterSheetItem && (
            <LaterBottomSheet
              item={laterSheetItem}
              onChange={(patch) => updateLaterItem(laterSheetItem.id, patch)}
              onClose={() => setLaterSheetId(null)}
              onDelete={() => deleteLaterItem(laterSheetItem, null)}
              onReturnToArrange={(date, time) => returnLaterItemToArrange(laterSheetItem, date, time)}
            />
          )}
          {toastNode}
        </div>
      );
    }

    if (currentPage === "insight") {
      return <InsightPreview />;
    }

    return (
      <div className="flex h-full flex-col bg-bg">
        <MobileHeader
          onMenuClick={() => setShowMenu(true)}
          onSearchClick={() => setShowSearch(true)}
          unreadCount={unreadAiConversationCount + unreadTestConversationCount}
        />
        {homeMessagePreview && (
          <div className="shrink-0 bg-bg px-4 pb-2">
            <HomeNewMessagePreview
              preview={homeMessagePreview}
              onOpen={openHomeMessagePreview}
            />
          </div>
        )}
        <Records
          compactHeader
          demoRecords={[...demoRecords, ...testDemoReplyRecords]}
          aiConversationEntries={aiConversationLogEntries}
          selfRecords={selfRecords}
          onCreateSelfRecord={createSelfRecord}
          onOpenSourceConversation={openSourceConversation}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      </div>
    );
  };

  return (
    <AppShell
      mainPane={
        <div className="relative flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-hidden">{renderMainContent()}</main>
          {!recordDetail && !showSearch && !showAnswerGuide && !showAiConversation && !showSendToSelf && !showTestConversation && !settingsView && (
            <MobileBottomNavigation currentPage={currentPage} onNavigate={onNavigate} />
          )}
          <MobileSideDrawer
            open={showMenu}
            onClose={() => setShowMenu(false)}
            onOpenAnswerGuide={() => {
              setShowMenu(false);
              setShowAnswerGuide(true);
            }}
            onOpenAiConversation={() => {
              openAiConversation(null);
            }}
            onOpenSendToSelf={() => {
              openSendToSelf(null);
            }}
            onOpenTestConversation={(conversationId) => {
              openTestConversation(conversationId);
            }}
            unreadAiConversationCount={unreadAiConversationCount}
            selfRecords={selfRecords}
            testConversations={testConversationSummaries}
          />
          <RecordDetailSheet
            record={recordSnapshot}
            onClose={() => setRecordSnapshot(null)}
            onOpenSource={openSourceConversation}
          />
        </div>
      }
    />
  );
}

function SearchScreen({
  searchQuery,
  searchHistory,
  records,
  onChangeSearchQuery,
  onCommitSearch,
  onClose,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  onOpenSourceConversation,
}: {
  searchQuery: string;
  searchHistory: string[];
  records: RecordItem[];
  onChangeSearchQuery: (value: string) => void;
  onCommitSearch: (value: string) => void;
  onClose: () => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
  onOpenSourceConversation: (source: RecordSourceConversation) => void;
}) {
  const { resolvedTheme, t } = usePreferences();
  const [activeTab, setActiveTab] = React.useState<"records" | "topics">("records");
  const [activeQuickType, setActiveQuickType] = React.useState<QuickSearchType | null>(null);
  const keyword = searchQuery.trim().toLowerCase();
  const hasSearchCondition = keyword.length > 0 || activeQuickType !== null;
  const searchTags = React.useMemo(
    () =>
      t("search.defaultTags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [t]
  );
  const emptyImageSrc =
    resolvedTheme === "dark"
      ? "/images/image_search_empty.png"
      : "/images/image_search_empty_light.png";

  const filteredRecords = React.useMemo(
    () =>
      records.filter((record) => {
        const content = record.text_content.toLowerCase();
        const matchesKeyword = !keyword || content.includes(keyword);
        const matchesQuickType =
          activeQuickType === null || recordMatchesQuickType(record, activeQuickType);
        return matchesKeyword && matchesQuickType;
      }),
    [activeQuickType, keyword, records]
  );

  const topicGroups = React.useMemo(
    () => buildSearchTopicGroups(records, t).filter((topic) => {
      if (!keyword) return topic.count > 0;
      return (
        topic.title.toLowerCase().includes(keyword) ||
        topic.description.toLowerCase().includes(keyword)
      );
    }),
    [keyword, records, t]
  );

  const handleKeywordSelect = (value: string) => {
    setActiveQuickType(null);
    onChangeSearchQuery(value);
    onCommitSearch(value);
  };

  const handleQuickSearch = (type: QuickSearchType) => {
    setActiveQuickType(type);
    setActiveTab("records");
    onChangeSearchQuery("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex h-[50px] shrink-0 items-center bg-bg pl-2.5">
        <div className="relative min-w-0 flex-1">
          <input
            value={searchQuery}
            onChange={(event) => {
              onChangeSearchQuery(event.target.value);
              setActiveQuickType(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitSearch(searchQuery);
                event.currentTarget.blur();
              }
            }}
            onBlur={() => onCommitSearch(searchQuery)}
            autoFocus
            placeholder={t("search.placeholder")}
            className="h-10 w-full rounded-[12px] bg-surface px-2.5 pr-12 text-[16px] leading-10 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-fill-2 text-text-tertiary transition active:scale-[0.94]"
              onClick={() => {
                onChangeSearchQuery("");
                setActiveQuickType(null);
              }}
              aria-label={t("search.clear")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 px-[19px] py-2 text-[16px] leading-6 text-text transition active:scale-[0.96]"
          onClick={onClose}
        >
          {t("search.cancel")}
        </button>
      </header>

      {!hasSearchCondition ? (
        <SearchLanding
          searchHistory={searchHistory}
          searchTags={searchTags}
          onKeywordSelect={handleKeywordSelect}
          onQuickSearch={handleQuickSearch}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <SearchTabs
            activeTab={activeTab}
            activeQuickType={activeQuickType}
            onChangeTab={setActiveTab}
            onClearQuickType={() => setActiveQuickType(null)}
          />
          {activeTab === "records" ? (
            filteredRecords.length > 0 ? (
              <ChatList
                records={filteredRecords}
                hasMore={false}
                loading={false}
                onLoadMore={() => undefined}
                onOpenSourceConversation={onOpenSourceConversation}
                onOpenRecordDetail={onOpenRecordDetail}
                onOpenRecordSnapshot={onOpenRecordSnapshot}
              />
            ) : (
              <SearchEmptyState
                imageSrc={emptyImageSrc}
                keyword={searchQuery || quickSearchLabel(activeQuickType, t)}
              />
            )
          ) : topicGroups.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {topicGroups.map((topic) => (
                  <button
                    key={topic.key}
                    type="button"
                    className="flex min-h-[62px] w-full items-center rounded-[12px] bg-surface px-3 text-left transition active:scale-[0.99]"
                    onClick={() => handleKeywordSelect(topic.searchKeyword)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">
                      {topic.icon}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium leading-5 text-text">
                        {topic.title}
                      </p>
                      <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
                        {formatTemplate(t("search.topicCount"), {
                          count: String(topic.count),
                        })}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-disabled" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <SearchEmptyState imageSrc={emptyImageSrc} keyword={searchQuery} />
          )}
        </div>
      )}
    </div>
  );
}

function SearchLanding({
  searchHistory,
  searchTags,
  onKeywordSelect,
  onQuickSearch,
}: {
  searchHistory: string[];
  searchTags: string[];
  onKeywordSelect: (value: string) => void;
  onQuickSearch: (type: QuickSearchType) => void;
}) {
  const { t } = usePreferences();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-[22px]">
      {searchHistory.length > 0 && (
        <section className="pb-[22px]">
          <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
            {t("search.recent")}
          </p>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {searchHistory.map((keyword) => (
              <SearchChip
                key={keyword}
                label={keyword}
                textClassName="text-text"
                onClick={() => onKeywordSelect(keyword)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
          {t("search.quickSearch")}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {quickSearchTypes.map((type) => (
            <SearchChip
              key={type}
              label={quickSearchLabel(type, t)}
              textClassName="text-link"
              onClick={() => onQuickSearch(type)}
            />
          ))}
        </div>
      </section>

      {searchTags.length > 0 && (
        <section className="mt-[30px]">
          <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
            {t("search.tags")}
          </p>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1.5">
            {searchTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="px-2 py-[3px] text-[14px] leading-5 text-link transition active:scale-[0.97]"
                onClick={() => onKeywordSelect(tag.replace(/^#/, ""))}
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SearchTabs({
  activeTab,
  activeQuickType,
  onChangeTab,
  onClearQuickType,
}: {
  activeTab: "records" | "topics";
  activeQuickType: QuickSearchType | null;
  onChangeTab: (tab: "records" | "topics") => void;
  onClearQuickType: () => void;
}) {
  const { t } = usePreferences();
  const tabs: Array<{ key: "records" | "topics"; label: string }> = [
    { key: "records", label: t("search.tabRecords") },
    { key: "topics", label: t("search.tabTopics") },
  ];

  return (
    <div className="flex h-[30px] shrink-0 items-center bg-gray-8">
      <div className="ml-[18px] flex min-w-0 flex-1 items-center gap-[30px]">
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={cn(
                "relative h-[30px] px-0 pb-1 text-[14px] leading-[24px] transition",
                selected ? "font-semibold text-primary" : "font-normal text-text"
              )}
              onClick={() => onChangeTab(tab.key)}
            >
              {tab.label}
              {selected && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-2.5 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      {activeQuickType && (
        <button
          type="button"
          className="mr-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] leading-5 text-primary transition active:scale-[0.96]"
          onClick={onClearQuickType}
        >
          {quickSearchLabel(activeQuickType, t)}
        </button>
      )}
      <button
        type="button"
        className="mr-[18px] flex h-[21px] w-[23px] items-center justify-center text-text-muted transition active:scale-[0.96]"
        aria-label={t("search.filter")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function SearchChip({
  label,
  textClassName,
  onClick,
}: {
  label: string;
  textClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-full border border-[var(--record-topic-border)] px-3 py-[3px] text-[14px] leading-5 transition active:scale-[0.97]",
        textClassName
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SearchEmptyState({ imageSrc, keyword }: { imageSrc: string; keyword: string }) {
  const { t } = usePreferences();
  const label = keyword.trim() || t("search.label");

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center px-4 pt-20 text-center">
      <div>
        <img src={imageSrc} alt="" className="mx-auto w-[140px]" aria-hidden="true" />
        <p className="mt-2.5 whitespace-pre-line text-[14px] leading-5 text-text-tertiary">
          {formatTemplate(t("search.noResult"), { keyword: label })}
        </p>
      </div>
    </div>
  );
}

function quickSearchLabel(type: QuickSearchType | null, t: (key: string) => string) {
  if (!type) return "";
  return t(`search.quick.${type}`);
}

function recordMatchesQuickType(record: RecordItem, type: QuickSearchType) {
  const content = record.text_content.toLowerCase();
  const sourceLabel = record.sourceConversation?.label.toLowerCase() ?? "";
  const combined = `${content} ${sourceLabel}`;

  switch (type) {
    case "image":
      return /图片|照片|视频|image|photo|video/.test(combined);
    case "audio":
      return /语音|音频|录音|voice|audio|recording/.test(combined);
    case "link":
      return /链接|http|link|url/.test(combined);
    case "file":
      return /文件|文档|file|document/.test(combined);
    case "longArticle":
      return Array.from(record.text_content).length >= 80;
    case "contact":
      return /联系人|同事|候选人|用户|ai|contact|user/.test(combined);
    default:
      return true;
  }
}

function buildSearchTopicGroups(records: RecordItem[], t: (key: string) => string) {
  const quickNotes = records.filter((record) => !record.sourceConversation);
  const selfNotes = records.filter((record) => record.sourceConversation?.type === "self");
  const aiNotes = records.filter((record) => record.sourceConversation?.type === "ai");

  return [
    {
      key: "quick",
      icon: t("search.topicQuickIcon"),
      title: t("records.title"),
      description: t("recordDetail.quickNoteSource"),
      count: quickNotes.length,
      searchKeyword: t("records.title"),
    },
    {
      key: "self",
      icon: t("sendToSelf.icon"),
      title: t("sendToSelf.title"),
      description: t("sendToSelf.privateTag"),
      count: selfNotes.length,
      searchKeyword: t("sendToSelf.title"),
    },
    {
      key: "ai",
      icon: "AI",
      title: t("ai.title"),
      description: t("ai.rounds"),
      count: aiNotes.length,
      searchKeyword: "AI",
    },
  ];
}

function MobileHeader({
  onMenuClick,
  onSearchClick,
  unreadCount,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
  unreadCount: number;
}) {
  const { appIcon, resolvedTheme, t } = usePreferences();
  const logoSrc = getJiwoLogoSrc(appIcon, resolvedTheme);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-bg px-4">
      <button
        type="button"
        className="flex h-9 items-center gap-[2px] text-text transition active:scale-[0.96]"
        onClick={onMenuClick}
        aria-label={t("common.openMenu")}
      >
        <span className="flex h-9 w-5 items-center justify-center">
          <svg
            className="h-6 w-5"
            viewBox="0 0 20 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5 6.25C5 5.55964 5.55964 5 6.25 5H12.75C13.4404 5 14 5.55964 14 6.25C14 6.94036 13.4404 7.5 12.75 7.5H6.25C5.55964 7.5 5 6.94036 5 6.25ZM5 12.25C5 11.5596 5.55964 11 6.25 11H15.75C16.4404 11 17 11.5596 17 12.25C17 12.9404 16.4404 13.5 15.75 13.5H6.25C5.55964 13.5 5 12.9404 5 12.25ZM6.25 17C5.55964 17 5 17.5596 5 18.25C5 18.9404 5.55964 19.5 6.25 19.5H9.75C10.4404 19.5 11 18.9404 11 18.25C11 17.5596 10.4404 17 9.75 17H6.25Z"
              fill="currentColor"
            />
          </svg>
        </span>
        {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
        <img src={logoSrc} alt="" className="h-8 w-8" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onSearchClick}
          aria-label={t("search.label")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 25 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.0969 19.0453C14.9754 19.0453 18.1196 15.9012 18.1196 12.0227C18.1196 8.14416 14.9754 5 11.0969 5C7.21838 5 4.07422 8.14416 4.07422 12.0227C4.07422 15.9012 7.21838 19.0453 11.0969 19.0453ZM11.0969 21.0453C16.08 21.0453 20.1196 17.0058 20.1196 12.0227C20.1196 7.03959 16.08 3 11.0969 3C6.11381 3 2.07422 7.03959 2.07422 12.0227C2.07422 17.0058 6.11381 21.0453 11.0969 21.0453Z"
              fill="currentColor"
            />
            <path
              d="M16.8203 17.8184L19.7295 20.7282"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

function HomeNewMessagePreview({
  preview,
  onOpen,
}: {
  preview: HomeMessagePreview;
  onOpen: () => void;
}) {
  const { t } = usePreferences();
  const unreadLabel = formatUnreadCount(preview.unreadCount);

  return (
    <button
      type="button"
      className="flex w-full items-center rounded-[16px] border border-border-light bg-surface px-3 py-2.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:bg-[var(--record-card-hover-bg)] active:scale-[0.99] dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
      onClick={onOpen}
      aria-label={`${t("homeMessagePreview.label")}，${preview.summary.title}`}
    >
      <AvatarUnreadWrap unreadCount={preview.unreadCount}>
        <TestConversationAvatar summary={preview.summary} className="h-[34px] w-[34px]" />
      </AvatarUnreadWrap>
      <div className="ml-3 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[14px] font-medium leading-5 text-text">
              {preview.summary.title}
            </p>
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-[2px] text-[10px] font-medium leading-3 text-primary">
              {t("homeMessagePreview.label")}
            </span>
          </div>
          <span className="shrink-0 text-[11px] leading-4 text-text-tertiary">
            {formatBubbleTime(preview.message.sentAt)}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs leading-4 text-text-muted">
            {preview.message.text}
          </p>
          <span className="shrink-0 text-[11px] leading-4 text-primary">
            {unreadLabel}
            {t("common.unreadCount")}
          </span>
        </div>
      </div>
      <svg
        className="ml-2 h-4 w-4 shrink-0 text-text-tertiary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function getLatestRecord(records: RecordItem[]) {
  return records.reduce<RecordItem | null>((latest, record) => {
    if (!latest || record.send_at > latest.send_at) return record;
    return latest;
  }, null);
}

function MobileSideDrawer({
  open,
  onClose,
  onOpenAnswerGuide,
  onOpenAiConversation,
  onOpenSendToSelf,
  onOpenTestConversation,
  unreadAiConversationCount,
  selfRecords,
  testConversations,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAnswerGuide: () => void;
  onOpenAiConversation: () => void;
  onOpenSendToSelf: () => void;
  onOpenTestConversation: (conversationId: string) => void;
  unreadAiConversationCount: number;
  selfRecords: RecordItem[];
  testConversations: TestConversationSummary[];
}) {
  const { t } = usePreferences();
  const latestSelfRecord = React.useMemo(
    () => getLatestRecord(selfRecords),
    [selfRecords]
  );
  const latestAiEntry = aiConversationLogEntries.at(-1);
  const latestAiTime = latestAiEntry
    ? parseAiConversationTimestamp(latestAiEntry.timestamp, 0)
    : 0;
  const conversationItems = React.useMemo(
    () =>
      [
        {
          key: "self",
          latestAt: latestSelfRecord?.send_at ?? 0,
          node: (
            <SendToSelfDrawerItem
              records={selfRecords}
              latestRecord={latestSelfRecord}
              onClick={onOpenSendToSelf}
            />
          ),
        },
        {
          key: "ai",
          latestAt: latestAiTime,
          node: (
            <AiToolConversationItem
              onClick={onOpenAiConversation}
              unreadCount={unreadAiConversationCount}
              latestAt={latestAiTime}
            />
          ),
        },
        ...testConversations.map((summary) => ({
          key: `test-${summary.conversationId}`,
          latestAt: summary.latestMessage.sentAt,
          node: (
            <TestConversationDrawerItem
              summary={summary}
              onClick={() => onOpenTestConversation(summary.conversationId)}
            />
          ),
        })),
      ].sort((a, b) => b.latestAt - a.latestAt),
    [
      latestAiTime,
      latestSelfRecord,
      onOpenAiConversation,
      onOpenSendToSelf,
      onOpenTestConversation,
      selfRecords,
      testConversations,
      unreadAiConversationCount,
    ]
  );

  return (
    <div
      className={cn(
        "absolute inset-x-0 -top-9 z-50 h-[calc(100%+36px)] transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-overlay-light transition-opacity duration-150 ease-out",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-label={t("drawer.closeMask")}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full w-[296px] max-w-[82%] flex-col bg-surface px-4 pb-4 pt-[52px] shadow-[8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-[180ms] ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-label={t("drawer.label")}
      >
        <h2 className="-mx-1 px-3 pb-[5px] pt-[3px] text-xl font-semibold leading-[1.2] text-text">
          {t("drawer.title")}
        </h2>

        <nav className="-mx-4 mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pb-3">
          <GuideConversationItem onClick={onOpenAnswerGuide} />
          {conversationItems.map((item) => (
            <React.Fragment key={item.key}>{item.node}</React.Fragment>
          ))}
        </nav>

        <div className="mt-auto rounded-[12px] bg-bg px-3 py-3">
          <p className="text-xs font-semibold text-text">{t("drawer.footerTitle")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
            {t("drawer.footerDesc")}
          </p>
        </div>
      </aside>
    </div>
  );
}

function SendToSelfDrawerItem({
  records,
  latestRecord,
  onClick,
}: {
  records: RecordItem[];
  latestRecord: RecordItem | null;
  onClick: () => void;
}) {
  const { t } = usePreferences();

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <SendToSelfIcon className="h-[30px] w-[30px] shrink-0" />
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            <p className="truncate text-[16px] font-normal leading-6 text-text">
              {t("sendToSelf.title")}
            </p>
            <OverviewEntryTag label={t("sendToSelf.privateTag")} />
          </div>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {latestRecord
              ? formatBubbleTime(latestRecord.send_at)
              : formatRoundCount(records.length, t("sendToSelf.recordCount"))}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {latestRecord?.text_content ?? t("sendToSelf.emptyPreview")}
        </p>
      </div>
    </button>
  );
}

function GuideConversationItem({ onClick }: { onClick: () => void }) {
  const { t } = usePreferences();

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-[11px] font-semibold text-primary">
        {t("guide.avatar")}
      </div>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {t("guide.title")}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {t("guide.pinned")}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {t("guide.subtitle")}
        </p>
      </div>
    </button>
  );
}

function AvatarUnreadWrap({
  unreadCount,
  children,
}: {
  unreadCount: number;
  children: React.ReactNode;
}) {
  const label = formatUnreadCount(unreadCount);

  return (
    <span className="relative shrink-0">
      {children}
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-primary text-[10px] font-normal leading-none text-on-primary",
            label.length > 1 ? "px-[4px]" : "px-0"
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

function AiToolConversationItem({
  onClick,
  unreadCount,
  latestAt,
}: {
  onClick: () => void;
  unreadCount: number;
  latestAt: number;
}) {
  const { t } = usePreferences();
  const latestEntry = aiConversationLogEntries.at(-1);

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <AvatarUnreadWrap unreadCount={unreadCount}>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
          AI
        </div>
      </AvatarUnreadWrap>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {t("ai.title")}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {latestAt > 0
              ? formatBubbleTime(latestAt)
              : `${aiConversationLogEntries.length}${t("ai.rounds")}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {latestEntry?.userInput ?? t("ai.emptyTitle")}
        </p>
      </div>
    </button>
  );
}

function TestConversationDrawerItem({
  summary,
  onClick,
}: {
  summary: TestConversationSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <AvatarUnreadWrap unreadCount={summary.unreadCount}>
        <TestConversationAvatar summary={summary} className="h-[30px] w-[30px]" />
      </AvatarUnreadWrap>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {summary.title}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {formatBubbleTime(summary.latestMessage.sentAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {summary.conversationType === "group" &&
          summary.latestMessage.sender === "identity"
            ? `${summary.memberIdentities.find((identity) => identity.id === summary.latestMessage.identityId)?.name ?? "成员"}：${summary.latestMessage.text}`
            : summary.latestMessage.text}
        </p>
      </div>
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  const { t } = usePreferences();
  const label = formatUnreadCount(count);

  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-normal leading-[14px] text-on-primary",
        label.length > 1 ? "px-[5px]" : "px-0"
      )}
      aria-label={`${label}${t("common.unreadCount")}`}
    >
      {label}
    </span>
  );
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function AiToolConversationChat({
  onBack,
  targetIndex,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: {
  onBack: () => void;
  targetIndex?: number | null;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
}) {
  const { t } = usePreferences();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const entryRefs = React.useRef<Array<HTMLElement | null>>([]);
  const fallbackBaseTime = React.useMemo(() => Date.now(), []);

  const makeUserInputRecord = React.useCallback(
    (entry: (typeof aiConversationLogEntries)[number], index: number): RecordItem => {
      const timestamp = parseAiConversationTimestamp(
        entry.timestamp,
        fallbackBaseTime + index
      );
      return {
        uid: `ai-conversation-user-${index}`,
        text_content: entry.userInput,
        send_at: timestamp,
        create_at: timestamp,
        update_at: timestamp,
        sourceConversation: {
          type: "ai",
          label: t("ai.title"),
          actionLabel: t("records.openSource"),
          iconLabel: "AI",
          entryIndex: index,
        },
      };
    },
    [fallbackBaseTime, t]
  );

  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (targetIndex !== null && targetIndex !== undefined) {
      entryRefs.current[targetIndex]?.scrollIntoView({
        block: "center",
      });
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [targetIndex]);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
            AI
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {t("ai.title")}
            </h1>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {formatRoundCount(aiConversationLogEntries.length, t("ai.rounds"))}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 pt-4"
      >
        {aiConversationLogEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-sm font-semibold text-primary">
                AI
              </div>
              <p className="mt-4 text-sm font-semibold text-text">
                {t("ai.emptyTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                {t("ai.emptyDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-6">
            {aiConversationLogEntries.map((entry, index) => (
              <section
                key={`${entry.timestamp}-${index}`}
                ref={(node) => {
                  entryRefs.current[index] = node;
                }}
                className={cn(
                  "min-w-0 scroll-mt-4 space-y-3 transition-colors duration-300",
                  targetIndex === index && "-m-1 rounded-[18px] bg-primary-soft/70 p-1"
                )}
              >
                <div className="flex justify-center">
                  <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
                    {entry.timestamp}
                  </span>
                </div>

                <div className="flex min-w-0 justify-end gap-2">
                  <div className="-mx-4 min-w-0 flex-1">
                    {(() => {
                      const userInputRecord = makeUserInputRecord(entry, index);
                      return (
                        <ChatBubble
                          textContent={userInputRecord.text_content}
                          disableAnimation
                          variant="primary"
                          onOpenDetail={() => onOpenRecordDetail(userInputRecord)}
                          onOpenMemorySnapshot={() =>
                            onOpenRecordSnapshot(userInputRecord)
                          }
                        />
                      );
                    })()}
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
                    AI
                  </div>
                  <div className="min-w-0 max-w-[82%]">
                    <p className="mb-1 px-1 text-[11px] leading-4 text-text-tertiary">
                      {t("ai.output")}
                    </p>
                    <div className="max-w-full rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-text [overflow-wrap:anywhere]">
                        {entry.aiFinalOutput}
                      </p>
                    </div>

                    <div className="mt-2 min-w-0 max-w-full rounded-[10px] bg-surface-muted px-3 py-2">
                      <p className="text-[11px] font-semibold leading-4 text-text">
                        {t("ai.changedFiles")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.changedFiles.map((file) => (
                          <li key={file} className="break-words text-[11px] leading-4 text-text-muted [overflow-wrap:anywhere]">
                            {file}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] font-semibold leading-4 text-text">
                        {t("ai.verification")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.verification.map((item) => (
                          <li key={item} className="break-words text-[11px] leading-4 text-text-muted [overflow-wrap:anywhere]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendToSelfConversationChat({
  records,
  targetUid,
  onBack,
  onCreateRecord,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: {
  records: RecordItem[];
  targetUid?: string | null;
  onBack: () => void;
  onCreateRecord: (content: string) => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
}) {
  const { t } = usePreferences();
  const recordsWithoutSource = React.useMemo(
    () => records.map(({ sourceConversation: _sourceConversation, ...record }) => record),
    [records]
  );

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <SendToSelfIcon className="h-[30px] w-[30px] shrink-0" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center">
              <h1 className="truncate text-[18px] font-normal leading-6 text-text">
                {t("sendToSelf.title")}
              </h1>
              <OverviewEntryTag label={t("sendToSelf.privateTag")} />
            </div>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {formatRoundCount(records.length, t("sendToSelf.recordCount"))}
            </p>
          </div>
        </div>
      </header>

      <ChatList
        records={recordsWithoutSource}
        hasMore={false}
        loading={false}
        onLoadMore={() => undefined}
        targetRecordUid={targetUid}
        onOpenRecordDetail={onOpenRecordDetail}
        onOpenRecordSnapshot={onOpenRecordSnapshot}
      />
      <ChatInput
        onSubmit={onCreateRecord}
        onVoiceSubmit={() => onCreateRecord(t("records.voiceRecord"))}
      />
    </div>
  );
}

function TestIdentityConversationChat({
  summary,
  targetUid,
  onBack,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  onCreateReply,
}: {
  summary: TestConversationSummary;
  targetUid?: string | null;
  onBack: () => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
  onCreateReply: (content: string) => void;
}) {
  const { resolvedLocale, t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const selfDisplayName = candidateProfile?.name || t("recordDetail.me");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const recordRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const sortedRecords = React.useMemo(
    () => [...summary.records].sort((a, b) => a.send_at - b.send_at),
    [summary.records]
  );

  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (targetUid) {
      recordRefs.current.get(targetUid)?.scrollIntoView({ block: "center" });
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [sortedRecords.length, targetUid]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <TestConversationAvatar summary={summary} className="h-8 w-8" />
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {summary.title}
            </h1>
            <p className="mt-0.5 truncate text-[11px] leading-3 text-text-tertiary">
              {summary.subtitle}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4"
      >
        <div className="space-y-3">
          {sortedRecords.map((record, index) => {
            const prevRecord = sortedRecords[index - 1];
            const showTime =
              index === 0 || shouldShowConversationTime(prevRecord.send_at, record.send_at);

            return (
              <div
                key={record.uid}
                ref={(node) => {
                  if (node) {
                    recordRefs.current.set(record.uid, node);
                  } else {
                    recordRefs.current.delete(record.uid);
                  }
                }}
                className={cn(
                  "scroll-mt-4",
                  targetUid === record.uid && "rounded-[18px] bg-primary-soft/70 py-1"
                )}
              >
                {showTime && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
                      {formatTimeLabel(record.send_at, {
                        locale: resolvedLocale,
                        today: t("time.today"),
                        yesterday: t("time.yesterday"),
                        dayBeforeYesterday: t("time.dayBeforeYesterday"),
                      })}{" "}
                      {formatBubbleTime(record.send_at)}
                    </span>
                  </div>
                )}
                {record.sender === "demo" ? (
                  <div className="-mx-4">
                    <ChatBubble
                      textContent={record.text_content}
                      disableAnimation
                      variant="primary"
                      topLabel={
                        summary.conversationType === "group" ? selfDisplayName : undefined
                      }
                      onOpenDetail={() => onOpenRecordDetail(record)}
                      onOpenMemorySnapshot={() => onOpenRecordSnapshot(record)}
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <TestMessageIdentityAvatar
                      identityId={record.identityId}
                      summary={summary}
                    />
                    <div className="min-w-0 max-w-[82%]">
                      {summary.conversationType === "group" && (
                        <p className="mb-1 px-1 text-[11px] leading-4 text-text-tertiary">
                          {summary.memberIdentities.find(
                            (identity) => identity.id === record.identityId
                          )?.name ?? "群成员"}
                        </p>
                      )}
                      <button
                        type="button"
                        className="max-w-full rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 text-left text-text shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[var(--record-card-hover-bg)] active:scale-[0.99]"
                        onClick={() => onOpenRecordDetail(record)}
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55]">
                          {record.text_content}
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ChatInput
        onSubmit={onCreateReply}
        onVoiceSubmit={() => onCreateReply(t("records.voiceRecord"))}
      />
    </div>
  );
}

function shouldShowConversationTime(prevSendAt: number, currentSendAt: number) {
  return Math.abs(currentSendAt - prevSendAt) > 1000 * 60 * 5;
}

function TestIdentityAvatar({
  identity,
  className,
}: {
  identity: TestIdentity;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white",
        className
      )}
      style={{ backgroundColor: identity.color }}
      aria-hidden="true"
    >
      {identity.avatarLabel}
    </div>
  );
}

function TestConversationAvatar({
  summary,
  className,
}: {
  summary: TestConversationSummary;
  className?: string;
}) {
  if (summary.identity) {
    return <TestIdentityAvatar identity={summary.identity} className={className} />;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white",
        className
      )}
      style={{ backgroundColor: summary.color }}
      aria-hidden="true"
    >
      {summary.avatarLabel}
    </div>
  );
}

function TestMessageIdentityAvatar({
  identityId,
  summary,
}: {
  identityId: string;
  summary: TestConversationSummary;
}) {
  const identity =
    summary.memberIdentities.find((item) => item.id === identityId) ?? summary.identity;

  if (identity) {
    return <TestIdentityAvatar identity={identity} className="mt-0.5 h-8 w-8" />;
  }

  return <TestConversationAvatar summary={summary} className="mt-0.5 h-8 w-8" />;
}

function AnswerGuideChat({ onBack }: { onBack: () => void }) {
  const { resolvedLocale, t } = usePreferences();
  const guideTime = React.useMemo(() => Date.now(), []);
  const answerGuideMessages = [
    t("guide.message1"),
    t("guide.message2"),
    t("guide.message3"),
    t("guide.message4"),
    t("guide.message5"),
  ];

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-xs font-semibold text-primary">
            {t("guide.avatar")}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {t("guide.title")}
            </h1>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {t("guide.scope")}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
            {formatTimeLabel(guideTime, {
              locale: resolvedLocale,
              today: t("time.today"),
              yesterday: t("time.yesterday"),
              dayBeforeYesterday: t("time.dayBeforeYesterday"),
            })}{" "}
            {formatBubbleTime(guideTime)}
          </span>
        </div>
        <div className="space-y-3">
          {answerGuideMessages.map((message, index) => (
            <div key={message} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-xs font-semibold text-primary">
                {t("guide.avatar")}
              </div>
              <div className="max-w-[78%]">
                <div className="rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-text">
                    {message}
                  </p>
                </div>
                {index === 0 && (
                  <p className="mt-1 px-1 text-[11px] leading-4 text-text-tertiary">
                    {t("guide.title")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileBottomNavigation({
  currentPage,
  onNavigate,
}: {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}) {
  const { t } = usePreferences();

  return (
    <nav className="shrink-0 bg-bg px-2 pb-3 pt-1">
      <div className="flex h-12 items-center">
        {tabs.map((tab) => {
          const active = tab.key === currentPage;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onNavigate(tab.key)}
              className={cn(
                "flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] transition active:scale-[0.98]",
                active
                  ? "font-semibold text-text"
                  : "font-normal text-text-tertiary"
              )}
            >
              <TabIcon page={tab.key} active={active} />
              <span className="text-[13px] leading-4">{getTabLabel(tab.key, t)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ArrangePreview({
  items,
  autoArchivedPastIds,
  expandedCompletedDates,
  recentlyCompletedIds,
  onToggleCompleted,
  onCompleteToday,
  onDelete,
  onLater,
  onOpenSheet,
  onToggleCompletedDate,
  onReleaseRecentlyCompleted,
}: {
  items: ArrangeItem[];
  autoArchivedPastIds: Set<string>;
  expandedCompletedDates: string[];
  recentlyCompletedIds: string[];
  onToggleCompleted: (id: string, currentCompleted: boolean) => void;
  onCompleteToday: (id: string) => void;
  onDelete: (item: ArrangeItem, insertBeforeId: string | null) => void;
  onLater: (item: ArrangeItem, insertBeforeId: string | null) => void;
  onOpenSheet: (id: string) => void;
  onToggleCompletedDate: (date: string) => void;
  onReleaseRecentlyCompleted: (id: string) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const todayRef = React.useRef<HTMLDivElement | null>(null);
  const todayDate = formatArrangeDateValue(new Date());

  const visibleItems = React.useMemo(
    () =>
      items
        .filter((item) => !item.dismissed && !autoArchivedPastIds.has(item.id))
        .slice()
        .sort((a, b) => getArrangeTimestamp(a) - getArrangeTimestamp(b)),
    [items, autoArchivedPastIds]
  );

  const handleCardDelete = React.useCallback(
    (id: string) => {
      const idx = visibleItems.findIndex((it) => it.id === id);
      if (idx < 0) return;
      onDelete(visibleItems[idx], visibleItems[idx + 1]?.id ?? null);
    },
    [visibleItems, onDelete]
  );

  const handleCardLater = React.useCallback(
    (id: string) => {
      const idx = visibleItems.findIndex((it) => it.id === id);
      if (idx < 0) return;
      onLater(visibleItems[idx], visibleItems[idx + 1]?.id ?? null);
    },
    [visibleItems, onLater]
  );

  const dayGroups = React.useMemo(() => {
    const grouped = new Map<string, ArrangeItem[]>();

    visibleItems.forEach((item) => {
      const bucket = grouped.get(item.date) ?? [];
      bucket.push(item);
      grouped.set(item.date, bucket);
    });

    return Array.from(grouped.entries())
      .sort((left, right) => getArrangeTimestamp({ date: left[0] }) - getArrangeTimestamp({ date: right[0] }))
      .map(([date, dateItems]) => ({
        date,
        activeItems: dateItems.filter((item) => !item.completed),
        completedItems: dateItems.filter((item) => item.completed),
      }));
  }, [visibleItems]);

  React.useEffect(() => {
    const container = scrollRef.current;
    const todayNode = todayRef.current;
    if (!container || !todayNode) return;

    const target = Math.max(0, todayNode.offsetTop - container.clientHeight * 0.01);
    requestAnimationFrame(() => {
      container.scrollTo({ top: target, behavior: "auto" });
    });
  }, []);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container || recentlyCompletedIds.length === 0) return;

    const checkVisibility = () => {
      const containerRect = container.getBoundingClientRect();
      recentlyCompletedIds.forEach((id) => {
        const card = container.querySelector('[data-arrange-card-id="' + id + '"]');
        if (!(card instanceof HTMLElement)) return;
        const rect = card.getBoundingClientRect();
        const stillVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
        if (!stillVisible) onReleaseRecentlyCompleted(id);
      });
    };

    container.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    return () => {
      container.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [recentlyCompletedIds, onReleaseRecentlyCompleted]);

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,var(--primary-soft)_0%,var(--bg)_18%,var(--bg)_100%)]">
      {autoArchivedPastIds.size > 0 && (
        <div className="mx-auto w-full max-w-[430px] px-4 pb-1">
          <p className="text-[11px] text-text-muted/50">{"早些时候的安排已收起"}</p>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pb-16 mobile-scroll">
        <div className="relative mx-auto min-h-full max-w-[430px] px-4 pb-10 pt-4">
          <div className="pointer-events-none absolute bottom-0 left-[40px] top-0 z-0 w-px bg-primary opacity-30" />

          <div className="relative z-10 space-y-3 pt-5">
            {dayGroups.map((group) => {
              const isExpanded = expandedCompletedDates.includes(group.date);
              const recentCompletedItems = group.completedItems.filter((item) =>
                recentlyCompletedIds.includes(item.id)
              );
              const visibleDayItems = isExpanded
                ? [...group.activeItems, ...group.completedItems]
                : [...group.activeItems, ...recentCompletedItems];
              // 隐藏的已完成数量 = 全部已完成 - 刚完成仍可见的（recentlyCompleted）
              const hiddenCompletedCount = isExpanded ? 0 : group.completedItems.length - recentCompletedItems.length;
              const dayDiff = getArrangeDayDifference(group.date);
              // 有折叠内容时显示"已完成 n 项"，展开时显示"收起已完成"
              const hasToggle = isExpanded ? group.completedItems.length > 0 : hiddenCompletedCount > 0;

              return (
                <section
                  key={group.date}
                  ref={group.date === todayDate ? todayRef : undefined}
                  className="relative pl-[42px]"
                >
                  <div className="relative flex min-h-4 items-center justify-between gap-2.5">
                    <div className="absolute left-[-18px] top-1/2 z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-bg">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </div>
                    <p className="min-w-0 text-[11px] font-medium leading-4 text-text">
                      {formatArrangeAxisPrimaryLabel(group.date) + " / " + formatArrangeAxisSecondaryLabel(group.date)}
                    </p>
                    {hasToggle && (
                      <button
                        type="button"
                        onClick={() => onToggleCompletedDate(group.date)}
                        className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] leading-4 text-text-muted transition hover:bg-border"
                      >
                        {hiddenCompletedCount > 0
                          ? "已完成 " + hiddenCompletedCount + " 项"
                          : "收起已完成"}
                      </button>
                    )}
                  </div>

                  {visibleDayItems.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      {visibleDayItems.map((item) => (
                        <ArrangeTimelineCard
                          key={item.id}
                          item={item}
                          dayDiff={dayDiff}
                          isRecentlyCompleted={recentlyCompletedIds.includes(item.id)}
                          onToggleCompleted={onToggleCompleted}
                          onCompleteToday={onCompleteToday}
                          onDelete={() => handleCardDelete(item.id)}
                          onLater={() => handleCardLater(item.id)}
                          onOpenSheet={() => onOpenSheet(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrangeTimelineCard({
  item,
  dayDiff,
  isRecentlyCompleted,
  onToggleCompleted,
  onCompleteToday,
  onDelete,
  onLater,
  onOpenSheet,
}: {
  item: ArrangeItem;
  dayDiff: number;
  isRecentlyCompleted: boolean;
  onToggleCompleted: (id: string, currentCompleted: boolean) => void;
  onCompleteToday: (id: string) => void;
  onDelete: () => void;
  onLater: () => void;
  onOpenSheet: () => void;
}) {
  const isPast = dayDiff < 0;
  const isFuture = dayDiff > 0;
  const [dragX, setDragX] = React.useState(0);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [showPastBubble, setShowPastBubble] = React.useState(false);
  const [bubbleStyle, setBubbleStyle] = React.useState<React.CSSProperties>({});
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const removeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);
  const metaParts = getArrangeMetaParts(item);
  const canSwipeLater = !item.completed;
  const swipeHintOpacity = canSwipeLater ? Math.min(1, Math.abs(dragX) / 96) : 0;
  const showLeftHint = dragX > 0;
  const showRightHint = dragX < 0;

  React.useEffect(() => {
    if (!showPastBubble) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowPastBubble(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showPastBubble]);

  React.useEffect(() => {
    return () => {
      if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
    };
  }, []);

  const resetDrag = React.useCallback(() => {
    pointerStateRef.current = null;
    setDragX(0);
  }, []);

  const triggerSwipe = React.useCallback(
    (direction: number) => {
      setIsRemoving(true);
      setDragX(direction > 0 ? 420 : -420);
      removeTimeoutRef.current = setTimeout(() => {
        if (direction > 0) onDelete();
        else onLater();
      }, 180);
    },
    [onDelete, onLater]
  );

  return (
    <div className="relative">
      {showPastBubble && (
        <div
          ref={bubbleRef}
          style={bubbleStyle}
          className="flex items-center gap-1 rounded-2xl border border-primary/15 bg-surface px-1.5 py-1.5 shadow-soft"
        >
          <button
            type="button"
            onClick={() => { onToggleCompleted(item.id, false); setShowPastBubble(false); }}
            className="rounded-xl px-3 py-1.5 text-[12px] text-text-muted transition hover:bg-surface-2 active:scale-[0.97]"
          >
            {"当时完成"}
          </button>
          <button
            type="button"
            onClick={() => { onCompleteToday(item.id); setShowPastBubble(false); }}
            className="rounded-xl bg-primary/10 px-3 py-1.5 text-[12px] text-primary transition hover:bg-primary/15 active:scale-[0.97]"
          >
            {"今天完成"}
          </button>
        </div>
      )}
      <div className="relative overflow-hidden rounded-[16px]">
      {canSwipeLater && (
        <>
          {/* 右滑 = 删除，灰色背景 */}
          <div
            className="absolute inset-0 rounded-[16px] bg-surface-2"
            style={{ opacity: showLeftHint ? swipeHintOpacity : 0 }}
          />
          {/* 左滑 = 以后再说，浅绿背景 */}
          <div
            className="absolute inset-0 rounded-[16px] bg-[#d6f0dd]"
            style={{ opacity: showRightHint ? swipeHintOpacity : 0 }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-4 text-sm">
            <span className={cn("transition-opacity duration-150 text-text-muted", showLeftHint ? "opacity-100" : "opacity-0")}>
              {"删除"}
            </span>
            <span className={cn("transition-opacity duration-150 text-[#5a9e72]", showRightHint ? "opacity-100" : "opacity-0")}>
              {"以后再说"}
            </span>
          </div>
        </>
      )}
      <article
        data-arrange-card-id={item.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          onOpenSheet();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenSheet();
          }
        }}
        onPointerDown={(event) => {
          if (isRemoving || !canSwipeLater) return;
          pointerStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            dragging: false,
          };
        }}
        onPointerMove={(event) => {
          const state = pointerStateRef.current;
          if (!state || state.pointerId !== event.pointerId || isRemoving || !canSwipeLater) return;
          const dx = event.clientX - state.startX;
          const dy = event.clientY - state.startY;
          if (!state.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
            state.dragging = true;
          }
          if (state.dragging) {
            suppressClickRef.current = true;
            setDragX(Math.max(-140, Math.min(140, dx)));
          }
        }}
        onPointerUp={(event) => {
          const state = pointerStateRef.current;
          if (!state || state.pointerId !== event.pointerId || isRemoving || !canSwipeLater) return;
          const dx = event.clientX - state.startX;
          if (state.dragging && Math.abs(dx) > 72) {
            triggerSwipe(dx);
          } else {
            setDragX(0);
          }
          pointerStateRef.current = null;
        }}
        onPointerCancel={resetDrag}
        className={cn(
          "relative w-full rounded-[16px] border border-primary/10 bg-surface px-4 py-2.5 shadow-soft outline-none transition-[transform,opacity] duration-[180ms] focus-visible:ring-2 focus-visible:ring-primary/20",
          isPast ? "opacity-[0.45]" : "opacity-100",
          item.completed && !isRecentlyCompleted && "opacity-75",
          isRemoving && "pointer-events-none"
        )}
        style={{ transform: dragX ? 'translateX(' + dragX + 'px)' : undefined, touchAction: "pan-y" }}
      >
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            aria-label={item.completed ? "取消完成" : "标记完成"}
            onClick={(event) => {
              event.stopPropagation();
              if (item.completed) {
                // 反勾：直接取消完成，不弹浮层
                onToggleCompleted(item.id, item.completed);
                setShowPastBubble(false);
                return;
              }
              if (isFuture) {
                // 未来任务：自动移到今天完成
                onCompleteToday(item.id);
              } else if (isPast) {
                // 过去任务：fixed 定位气泡，避免被 overflow 容器裁切
                const r = event.currentTarget.getBoundingClientRect();
                const bubbleH = 52;
                const gap = 8;
                if (r.top > bubbleH + gap + 56) {
                  setBubbleStyle({ position: "fixed", left: r.left, top: r.top - bubbleH - gap, zIndex: 300 });
                } else {
                  setBubbleStyle({ position: "fixed", left: r.left, top: r.bottom + gap, zIndex: 300 });
                }
                setShowPastBubble(true);
              } else {
                // 今天任务：直接完成
                onToggleCompleted(item.id, item.completed);
              }
            }}
            className={cn(
              "mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border transition active:scale-[0.97]",
              item.completed
                ? "border-primary bg-primary text-on-primary"
                : "border-border-strong bg-bg text-transparent hover:border-text-muted"
            )}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h2 className={cn("text-[14px] font-medium leading-[1.45] text-text", item.completed && "line-through decoration-text-muted/80 decoration-[1.5px]")}>
              {item.title}
            </h2>
            {metaParts.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-text-muted">
                {metaParts.map((part, index) => (
                  <React.Fragment key={item.id + '-' + part}>
                    {index > 0 && <span aria-hidden="true">{"·"}</span>}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>
      </div>
    </div>
  );
}

function ArrangeSourceContextBlock({
  sourceContext,
  labelClass,
}: {
  sourceContext: ArrangeSourceContext;
  labelClass: string;
}) {
  if (isArrangementSourceContext(sourceContext)) {
    return (
      <div className="py-3">
        <div className={labelClass}>{"来源"}</div>
        <p className="text-[13px] font-medium text-text">{"快记"}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
          {"“" + sourceContext.sourceText + "”"}
        </p>
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className={labelClass}>{"来源上下文"}</div>
      <p className="text-[13px] leading-relaxed text-text-muted">{sourceContext}</p>
    </div>
  );
}

function ArrangeBottomSheet({
  item,
  onChange,
  onClose,
  onDelete,
  onLater,
}: {
  item: ArrangeItem;
  onChange: (patch: Partial<ArrangeItem>) => void;
  onClose: () => void;
  onDelete: () => void;
  onLater: () => void;
}) {
  const fieldClass = "w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted/40";
  const labelClass = "mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60";

  return (
    <>
      <div className="absolute inset-0 z-30 bg-black/25" onClick={onClose} />
      <div className="absolute inset-0 z-40 flex items-center justify-center px-4 py-10">
      <div className="flex w-full max-h-full flex-col rounded-[20px] bg-bg shadow-[0_8px_32px_rgba(0,0,0,0.18)]">

        {/* \u6807\u9898\u680f */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
          <h2 className="text-[16px] font-semibold text-text">{"\u5b89\u6392\u8be6\u60c5"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-text-muted transition active:scale-95"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* \u53ef\u6eda\u52a8\u5b57\u6bb5\u533a */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
          {/* \u6807\u9898 */}
          <div className="border-b border-border/50 py-3">
            <div className={labelClass}>{"\u6807\u9898"}</div>
            <input
              value={item.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className={fieldClass + " text-[15px] font-medium"}
              placeholder={"\u5b89\u6392\u6807\u9898"}
            />
          </div>

          {/* \u65e5\u671f + \u65f6\u95f4 */}
          <div className="grid grid-cols-2 gap-4 border-b border-border/50 py-3">
            <div>
              <div className={labelClass}>{"\u65e5\u671f"}</div>
              <input
                type="date"
                value={item.date}
                onChange={(e) => onChange({ date: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <div className={labelClass}>{"\u65f6\u95f4"}</div>
              <input
                type="time"
                value={item.time ?? ""}
                onChange={(e) => onChange({ time: e.target.value || undefined })}
                className={fieldClass}
              />
            </div>
          </div>

          {/* \u5173\u8054\u4eba */}
          <div className="border-b border-border/50 py-3">
            <div className={labelClass}>{"\u5173\u8054\u4eba"}</div>
            <input
              value={item.person ?? ""}
              onChange={(e) => onChange({ person: e.target.value || undefined })}
              className={fieldClass}
              placeholder={"\u65e0"}
            />
          </div>

          {/* \u5730\u70b9 */}
          <div className="border-b border-border/50 py-3">
            <div className={labelClass}>{"\u5730\u70b9"}</div>
            <input
              value={item.location ?? ""}
              onChange={(e) => onChange({ location: e.target.value || undefined })}
              className={fieldClass}
              placeholder={"\u65e0"}
            />
          </div>

          {/* \u5907\u6ce8 */}
          <div className={item.sourceContext ? "border-b border-border/50 py-3" : "py-3"}>
            <div className={labelClass}>{"\u5907\u6ce8"}</div>
            <textarea
              value={item.note ?? ""}
              onChange={(e) => onChange({ note: e.target.value || undefined })}
              rows={3}
              className={fieldClass + " resize-none leading-relaxed"}
              placeholder={"\u6dfb\u52a0\u5907\u6ce8\u2026"}
            />
          </div>

          {/* \u6765\u6e90\u4e0a\u4e0b\u6587\uff08\u53ea\u8bfb\uff0c\u6709\u5185\u5bb9\u624d\u663e\u793a\uff09 */}
          {item.sourceContext && (
            <ArrangeSourceContextBlock sourceContext={item.sourceContext} labelClass={labelClass} />
          )}
        </div>

        {/* \u56fa\u5b9a\u5e95\u90e8\u64cd\u4f5c\u680f */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/50 px-8 py-4">
          <button
            type="button"
            onClick={onDelete}
            className="text-[14px] text-text-muted/70 transition active:scale-95"
          >
            {"\u5220\u9664"}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="text-[14px] text-[#5a9e72] transition active:scale-95"
          >
            {"\u4ee5\u540e\u518d\u8bf4"}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

// ─── LaterPage ────────────────────────────────────────────────────────────────

function LaterPage({
  items,
  onOpenSheet,
  onDelete,
  onReturnToArrange,
  onComplete,
}: {
  items: LaterItem[];
  onOpenSheet: (id: string) => void;
  onDelete: (item: LaterItem, insertBeforeId: string | null) => void;
  onReturnToArrange: (item: LaterItem, date: string, time?: string) => void;
  onComplete: (item: LaterItem, insertBeforeId: string | null, completeDate?: string) => void;
}) {
  const sorted = React.useMemo(
    () => [...items].sort((a, b) => (b.laterAt > a.laterAt ? 1 : -1)),
    [items]
  );

  const handleDelete = React.useCallback(
    (id: string) => {
      const idx = sorted.findIndex((it) => it.id === id);
      if (idx < 0) return;
      onDelete(sorted[idx], sorted[idx + 1]?.id ?? null);
    },
    [sorted, onDelete]
  );

  const handleReturnToArrange = React.useCallback(
    (id: string, date: string, time?: string) => {
      const item = sorted.find((it) => it.id === id);
      if (!item) return;
      onReturnToArrange(item, date, time);
    },
    [sorted, onReturnToArrange]
  );

  const handleComplete = React.useCallback(
    (id: string, completeDate?: string) => {
      const idx = sorted.findIndex((it) => it.id === id);
      if (idx < 0) return;
      onComplete(sorted[idx], sorted[idx + 1]?.id ?? null, completeDate);
    },
    [sorted, onComplete]
  );

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,var(--primary-soft)_0%,var(--bg)_18%,var(--bg)_100%)]">
      {/* 列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-16 mobile-scroll">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 pt-24 text-center">
            <p className="text-[15px] font-medium text-text-muted/60">{"暂时没有放在这里的安排"}</p>
            <p className="mt-1.5 text-[12px] text-text-muted/40">{"左滑安排卡片可以把它放到这里"}</p>
          </div>
        ) : (
          <div className="mx-auto max-w-[430px] space-y-2 px-4 pt-3">
            {sorted.map((item) => (
              <LaterListCard
                key={item.id}
                item={item}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onReturnToArrange={handleReturnToArrange}
                onOpenSheet={() => onOpenSheet(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LaterListCard ─────────────────────────────────────────────────────────────

function LaterListCard({
  item,
  onComplete,
  onDelete,
  onReturnToArrange,
  onOpenSheet,
}: {
  item: LaterItem;
  onComplete: (id: string, completeDate?: string) => void;
  onDelete: (id: string) => void;
  onReturnToArrange: (id: string, date: string, time?: string) => void;
  onOpenSheet: () => void;
}) {
  // ─── swipe state ───
  const [dragX, setDragX] = React.useState(0);
  const [snapped, setSnapped] = React.useState(false);   // 左滑"卡住"状态
  const [isRemoving, setIsRemoving] = React.useState(false);
  // ─── past-completion bubble ───
  const [showCompleteBubble, setShowCompleteBubble] = React.useState(false);
  const [bubbleStyle, setBubbleStyle] = React.useState<React.CSSProperties>({});
  const bubbleRef = React.useRef<HTMLDivElement>(null);

  const removeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startDragX: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);

  // 按钮区宽度（今天＋明天＋选时间 + gap + 右padding）
  const BUTTON_AREA = 196;
  const SNAP_THRESHOLD = 56;   // 左滑超过此距离→卡住
  const CLOSE_THRESHOLD = 40;  // 卡住后右滑超过此距离→回弹
  const DELETE_THRESHOLD = 72; // 右滑超过此距离→删除

  const isPast = !!item.originalDate && getArrangeDayDifference(item.originalDate) < 0;
  const today = formatArrangeDateValue(new Date());
  const tomorrow = formatArrangeDateValue(new Date(Date.now() + 86400000));

  // 关闭完成气泡（点击外部）
  React.useEffect(() => {
    if (!showCompleteBubble) return;
    const handle = (e: PointerEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowCompleteBubble(false);
      }
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [showCompleteBubble]);

  React.useEffect(() => () => {
    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
  }, []);

  const snapOpen = React.useCallback(() => { setSnapped(true); setDragX(-BUTTON_AREA); }, []);
  const snapClose = React.useCallback(() => { setSnapped(false); setDragX(0); }, []);

  const triggerDelete = React.useCallback(() => {
    setSnapped(false);
    setIsRemoving(true);
    setDragX(420);
    removeTimeoutRef.current = setTimeout(() => onDelete(item.id), 180);
  }, [item.id, onDelete]);

  const handleQuickReturn = React.useCallback((date: string) => {
    setSnapped(false);
    setIsRemoving(true);
    setDragX(-500);
    removeTimeoutRef.current = setTimeout(() => onReturnToArrange(item.id, date), 180);
  }, [item.id, onReturnToArrange]);

  const metaLabel = formatLaterOriginalDateLabel(item.originalDate, item.originalTime);
  const extraParts = [item.person, item.location].filter(Boolean) as string[];
  const deleteHintOpacity = !snapped && dragX > 0 ? Math.min(1, dragX / 96) : 0;

  return (
    <div className="relative">
      {/* 过去日程完成气泡 */}
      {showCompleteBubble && (
        <div
          ref={bubbleRef}
          style={bubbleStyle}
          className="flex items-center gap-1 rounded-2xl border border-primary/15 bg-surface px-1.5 py-1.5 shadow-soft"
        >
          <button
            type="button"
            onClick={() => { setShowCompleteBubble(false); onComplete(item.id, item.originalDate); }}
            className="rounded-xl px-3 py-1.5 text-[12px] text-text-muted transition hover:bg-surface-2 active:scale-[0.97]"
          >
            {"当时完成"}
          </button>
          <button
            type="button"
            onClick={() => { setShowCompleteBubble(false); onComplete(item.id); }}
            className="rounded-xl bg-primary/10 px-3 py-1.5 text-[12px] text-primary transition hover:bg-primary/15 active:scale-[0.97]"
          >
            {"今天完成"}
          </button>
        </div>
      )}

      {/* 滑动区域 — overflow-hidden 裁掉卡片滑出左边的部分 */}
      <div className="relative overflow-hidden rounded-[16px]">

        {/* 右滑删除底层提示 */}
        <div
          className="absolute inset-0 flex items-center px-4"
          style={{ opacity: deleteHintOpacity }}
        >
          <div className="absolute inset-0 bg-surface-2" />
          <span className="relative text-[13px] text-text-muted">{"删除"}</span>
        </div>

        {/* 左滑快捷按钮（常驻，卡片滑走后露出） */}
        <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-2">
          <button
            type="button"
            onClick={() => handleQuickReturn(today)}
            className="rounded-[10px] bg-[#d8f0e2] px-3 py-2 text-[13px] font-medium text-[#4a9464] transition active:scale-95"
          >
            {"今天"}
          </button>
          <button
            type="button"
            onClick={() => handleQuickReturn(tomorrow)}
            className="rounded-[10px] bg-[#e8f4ec] px-3 py-2 text-[13px] font-medium text-[#5a9e72] transition active:scale-95"
          >
            {"明天"}
          </button>
          <button
            type="button"
            onClick={() => { snapClose(); onOpenSheet(); }}
            className="rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] font-medium text-text-muted transition active:scale-95"
          >
            {"选时间"}
          </button>
        </div>

        {/* 卡片本体 — 滑动 */}
        <article
          data-later-card-id={item.id}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
            if (snapped) { snapClose(); return; }
            onOpenSheet();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!snapped) onOpenSheet(); }
          }}
          onPointerDown={(e) => {
            if (isRemoving) return;
            pointerStateRef.current = {
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              startDragX: snapped ? -BUTTON_AREA : 0,
              dragging: false,
            };
          }}
          onPointerMove={(e) => {
            const s = pointerStateRef.current;
            if (!s || s.pointerId !== e.pointerId || isRemoving) return;
            const dx = e.clientX - s.startX;
            const dy = e.clientY - s.startY;
            if (!s.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.dragging = true;
            if (s.dragging) {
              suppressClickRef.current = true;
              const rawX = s.startDragX + dx;
              if (snapped) {
                // 卡住状态：只允许向右拖回，最多回到0
                setDragX(Math.min(0, Math.max(rawX, -BUTTON_AREA - 16)));
              } else {
                // 自由状态：左→卡住区 / 右→删除提示
                setDragX(Math.max(-BUTTON_AREA - 16, Math.min(140, rawX)));
              }
            }
          }}
          onPointerUp={(e) => {
            const s = pointerStateRef.current;
            if (!s || s.pointerId !== e.pointerId || isRemoving) return;
            const dx = e.clientX - s.startX;
            if (s.dragging) {
              if (!snapped) {
                if (dx > DELETE_THRESHOLD) triggerDelete();
                else if (dx < -SNAP_THRESHOLD) snapOpen();
                else snapClose();
              } else {
                // 卡住状态下：右滑超过阈值→回弹关闭
                if (dx > CLOSE_THRESHOLD) snapClose();
                else snapOpen(); // 弹回卡住位置
              }
            }
            pointerStateRef.current = null;
          }}
          onPointerCancel={() => {
            pointerStateRef.current = null;
            if (snapped) snapOpen(); else snapClose();
          }}
          className={cn(
            "relative w-full rounded-[16px] border border-primary/10 bg-surface px-4 py-2.5 shadow-soft outline-none",
            "transition-[transform,opacity] duration-[200ms]",
            "focus-visible:ring-2 focus-visible:ring-primary/20",
            isRemoving && "pointer-events-none"
          )}
          style={{ transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined, touchAction: "pan-y" }}
        >
          <div className="flex items-start gap-2.5">
            {/* 勾选框 */}
            <button
              type="button"
              aria-label="标记完成"
              onClick={(e) => {
                e.stopPropagation();
                if (isPast) {
                  const r = e.currentTarget.getBoundingClientRect();
                  const bubbleH = 52; const gap = 8;
                  if (r.top > bubbleH + gap + 56) {
                    setBubbleStyle({ position: "fixed", left: r.left, top: r.top - bubbleH - gap, zIndex: 300 });
                  } else {
                    setBubbleStyle({ position: "fixed", left: r.left, top: r.bottom + gap, zIndex: 300 });
                  }
                  setShowCompleteBubble(true);
                } else {
                  onComplete(item.id);
                }
              }}
              className="mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border border-border-strong bg-bg text-transparent transition active:scale-[0.97] hover:border-text-muted"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-medium leading-[1.45] text-text">{item.title}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[11px] leading-[1.5] text-text-muted/70">
                <span>{metaLabel}</span>
                {extraParts.map((part) => (
                  <React.Fragment key={part}>
                    <span aria-hidden="true">{"·"}</span>
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </article>

      </div>
    </div>
  );
}

// ─── LaterBottomSheet ─────────────────────────────────────────────────────────

function LaterBottomSheet({
  item,
  onChange,
  onClose,
  onDelete,
  onReturnToArrange,
}: {
  item: LaterItem;
  onChange: (patch: Partial<LaterItem>) => void;
  onClose: () => void;
  onDelete: () => void;
  onReturnToArrange: (date: string, time?: string) => void;
}) {
  const fieldClass = "w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted/40";
  const labelClass = "mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60";

  const handleDateChange = (newDate: string) => {
    onChange({ originalDate: newDate });
    if (newDate) {
      // 用户设置了明确时间 → 自动放回安排
      onReturnToArrange(newDate, item.originalTime);
    }
  };

  return (
    <>
      <div className="absolute inset-0 z-30 bg-black/25" onClick={onClose} />
      <div className="absolute inset-0 z-40 flex items-center justify-center px-4 py-10">
        <div className="flex w-full max-h-full flex-col rounded-[20px] bg-bg shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
          {/* 标题栏 */}
          <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
            <h2 className="text-[16px] font-semibold text-text">{"安排详情"}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-text-muted transition active:scale-95"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4L12 12M12 4L4 12" /></svg>
            </button>
          </div>

          {/* 可滚动字段区 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
            {/* 标题 */}
            <div className="border-b border-border/50 py-3">
              <div className={labelClass}>{"标题"}</div>
              <input value={item.title} onChange={(e) => onChange({ title: e.target.value })} className={fieldClass + " text-[15px] font-medium"} placeholder={"安排标题"} />
            </div>
            {/* 日期（改为非空即放回） */}
            <div className="grid grid-cols-2 gap-4 border-b border-border/50 py-3">
              <div>
                <div className={labelClass}>{"日期"}</div>
                <input
                  type="date"
                  value={item.originalDate ?? ""}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <div className={labelClass}>{"时间"}</div>
                <input
                  type="time"
                  value={normalizeClockTime(item.originalTime) ?? ""}
                  onChange={(e) => onChange({ originalTime: e.target.value || undefined })}
                  className={fieldClass}
                />
              </div>
            </div>
            {/* 关联人 */}
            <div className="border-b border-border/50 py-3">
              <div className={labelClass}>{"关联人"}</div>
              <input value={item.person ?? ""} onChange={(e) => onChange({ person: e.target.value || undefined })} className={fieldClass} placeholder={"无"} />
            </div>
            {/* 地点 */}
            <div className="border-b border-border/50 py-3">
              <div className={labelClass}>{"地点"}</div>
              <input value={item.location ?? ""} onChange={(e) => onChange({ location: e.target.value || undefined })} className={fieldClass} placeholder={"无"} />
            </div>
            {/* 备注 */}
            <div className={item.sourceContext ? "border-b border-border/50 py-3" : "py-3"}>
              <div className={labelClass}>{"备注"}</div>
              <textarea value={item.note ?? ""} onChange={(e) => onChange({ note: e.target.value || undefined })} rows={3} className={fieldClass + " resize-none leading-relaxed"} placeholder={"添加备注…"} />
            </div>
            {/* 来源（只读） */}
            {item.sourceContext && (
              <ArrangeSourceContextBlock sourceContext={item.sourceContext} labelClass={labelClass} />
            )}
            {/* 提示：设置日期后自动放回 */}
            <p className="pb-2 text-[11px] text-text-muted/50">{"设置日期后，该安排会自动放回主时间轴"}</p>
          </div>

          {/* 底部操作栏：仅删除 */}
          <div className="flex shrink-0 items-center justify-end border-t border-border/50 px-6 py-4">
            <button
              type="button"
              onClick={onDelete}
              className="text-[14px] text-text-muted/70 transition active:scale-95"
            >
              {"删除"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ArrangeToast ─────────────────────────────────────────────────────────────

function ArrangeToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const dotIdx = message.indexOf(" \u00b7 ");
  const statusText = dotIdx >= 0 ? message.slice(0, dotIdx) : message;
  const actionText = dotIdx >= 0 ? message.slice(dotIdx + 3) : null;

  return (
    <div className="absolute bottom-[76px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#adadad] px-4 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.14)]">
      <span className="whitespace-nowrap text-[13px] text-white">{statusText}</span>
      {actionText && (
        <>
          <div className="h-3 w-px bg-white/40" />
          <button
            type="button"
            onClick={onUndo}
            className="whitespace-nowrap text-[13px] font-semibold text-[#8adcaa] transition active:opacity-70"
          >
            {actionText}
          </button>
        </>
      )}
    </div>
  );
}

function InsightPreview() {
  const { t } = usePreferences();

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center bg-bg px-4">
        <h1 className="text-lg font-semibold text-text">{t("insight.title")}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        <div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-text">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-text">
            {t("insight.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("insight.emptyDesc")}</p>
        </div>
      </div>
    </div>
  );
}

function MinePreview({
  records,
  onOpenSettings,
  onOpenAbout,
}: {
  records: RecordItem[];
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}) {
  const { resolvedLocale, resolvedTheme, t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const mineImagePrefix = resolvedTheme === "dark" ? "/images/mine/theme_dark/" : "/images/mine/";
  const mineUserName = candidateProfile?.name || t("mine.user");
  const mineAvatarLabel =
    candidateProfile?.avatarLabel || t("recordDetail.me").slice(0, 1);
  const quickNoteCount = records.length;
  const wordCount = records.reduce(
    (total, record) => total + countRecordTextLength(record.text_content),
    0
  );
  const quickNoteCountText = formatNumberForLocale(quickNoteCount, resolvedLocale);
  const wordCountText = formatNumberForLocale(wordCount, resolvedLocale);
  const mineStats = [
    t("mine.stat1"),
    formatStatTemplate(t("mine.stat2"), {
      count: quickNoteCountText,
      places: "0",
    }),
    t("mine.stat3"),
    formatStatTemplate(t("mine.stat4"), {
      words: wordCountText,
    }),
  ];
  const mineDataTags = [
    t("mine.tagImportExport"),
    t("mine.tagDataSecurity"),
    t("mine.tagPrivacy"),
  ];

  return (
    <div className="h-full overflow-y-auto bg-bg pb-4">
      <section className="relative overflow-hidden pb-5 pt-10">
        <img
          src="/images/mine/image_mine_page_background.png"
          alt=""
          className="pointer-events-none absolute -right-[52px] -top-11 h-[273px] w-[375px] max-w-none object-cover"
          aria-hidden="true"
        />

        <button
          type="button"
          className="absolute right-0 top-14 z-10 flex w-[98px] items-center rounded-l-[10px] bg-[var(--mine-world-bg)] py-[7px] pl-3 pr-1.5 text-[14px] leading-4 text-text transition active:scale-[0.98]"
        >
          {t("mine.world")}
          <ChevronRightIcon className="ml-0.5 h-4 w-4 shrink-0 text-text" />
        </button>

        <div className="relative z-10 flex items-center pl-4 pr-[112px]">
          <div
            className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border border-border-strong/80 bg-primary text-[23px] font-semibold leading-none text-on-primary shadow-[var(--mine-card-shadow)]"
            aria-label={t("mine.avatarAlt")}
          >
            {mineAvatarLabel}
          </div>
          <div className="ml-3 min-w-0">
            <div className="flex items-center">
              <p className="truncate text-xl leading-5 text-text">{mineUserName}</p>
              <ChevronRightIcon className="ml-1.5 h-4 w-4 shrink-0 text-text-disabled" />
            </div>
            <div className="mt-3 flex h-4 items-center">
              <div className="h-[3px] w-[83px] overflow-hidden rounded-full bg-[rgba(136,136,136,0.2)]">
                <div className="h-full w-[18%] rounded-full bg-primary" />
              </div>
              <p className="ml-2 text-xs leading-4 text-text-tertiary">
                {t("mine.storage")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-2.5 pt-[50px]">
        <button
          type="button"
          className="absolute left-2.5 right-2.5 top-2.5 z-0 flex min-h-[70px] items-start rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-member-bg)] px-2.5 pb-3 pt-3 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center">
              <p className="shrink-0 text-sm font-bold leading-4 text-text">
                {t("mine.memberTitle")}
              </p>
              <p className="ml-1.5 truncate text-xs leading-4 text-text-tertiary">
                {t("mine.memberDesc")}
              </p>
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center text-sm leading-4 text-primary">
            {t("mine.memberAction")}
            <ChevronRightIcon className="h-4 w-4" />
          </div>
        </button>

        <div className="relative z-10 overflow-hidden rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] shadow-[var(--mine-card-shadow)]">
          <img
            src={`${mineImagePrefix}image_mine_page_migong_background.png`}
            alt=""
            className="pointer-events-none absolute -right-px bottom-0 h-[179px] w-[179px]"
            aria-hidden="true"
          />
          <div className="relative px-3 pb-2.5 pt-2.5">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm leading-[22px] text-text-tertiary">
                {t("mine.statsTitle")}
              </p>
              <button
                type="button"
                className="ml-3 flex shrink-0 items-center text-sm leading-[22px] text-text-tertiary transition active:scale-[0.98]"
              >
                {t("mine.statsButton")}
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 space-y-0.5">
              {mineStats.map((line) => (
                <p key={line} className="text-base leading-7 text-text">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-2.5 px-2.5">
        <button
          type="button"
          className="relative w-full overflow-hidden rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
        >
          <img
            src={`${mineImagePrefix}image_mine_page_datamanager_protect_background.png`}
            alt=""
            className="pointer-events-none absolute -right-px bottom-0 h-24 w-[106px]"
            aria-hidden="true"
          />
          <div className="relative px-3 pb-2.5 pt-2.5">
            <h2 className="text-base font-bold leading-6 text-text">
              {t("mine.dataTitle")}
            </h2>
            <p className="mt-px text-sm leading-5 text-text-tertiary">
              {t("mine.dataDesc")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {mineDataTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[8px] bg-[rgba(136,136,136,0.12)] px-2 py-1 text-xs leading-4 text-text-tertiary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <MineActionCard
            title={t("mine.settings")}
            description={t("mine.settingsDesc")}
            onClick={onOpenSettings}
          />
          <MineActionCard
            title={t("mine.about")}
            description={t("mine.aboutDesc")}
            onClick={onOpenAbout}
          />
        </div>
      </section>
    </div>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  const { t } = usePreferences();
  const legalLinks = [
    {
      title: t("about.userAgreement"),
      url: "https://www.jiwo.cc/article/user-aggrement-v1.html",
    },
    {
      title: t("about.privacyTerms"),
      url: "https://www.jiwo.cc/article/privacy-aggrement-v1.html",
    },
    {
      title: t("about.privacyStatement"),
      url: "https://www.jiwo.cc/article/privacy-protect-v1.html?canReset=true",
    },
  ];
  const runLinks = [
    {
      title: t("about.wechatOfficial"),
      icon: "/images/about/icon_run_weixin_gongzhonghao.svg",
      url: "/images/about/image_wxgongzhonghao_qrcode.png",
    },
    {
      title: t("about.xiaohongshu"),
      icon: "/images/about/icon_run_xiaohongshu.svg",
      url: "https://www.xiaohongshu.com/user/profile/645464ff00000000290168b1?xhsshare=CopyLink&appuid=645464ff00000000290168b1&apptime=1716282708",
    },
    {
      title: t("about.douyin"),
      icon: "/images/about/icon_run_douyin.png",
      url: "https://www.douyin.com/user/MS4wLjABAAAACyK_g4xd0gUVN4ViU4FigeAYc2RFPO-sEp9RjXc6C4OWmDF9cJx9nzXBSEDw2J-C",
    },
    {
      title: t("about.jike"),
      icon: "/images/about/icon_run_jike.svg",
      url: "https://okjk.co/tHwXUq",
    },
    {
      title: t("about.weibo"),
      icon: "/images/about/icon_run_weibo.svg",
      url: "https://weibo.com/u/7960184078",
    },
  ];
  const footerRecords = [
    "ICP备案号：鄂ICP备2024037215号",
    "增值电信业务经营许可证：鄂B2-20240478",
    "模型名称：DeepSeek-R1",
    "互联网信息服务算法备案号：网信算备330110507206401230035号",
    "软著：软著登字第14519261号",
    "森奇思(武汉)科技有限公司",
  ];

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("mine.about")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-2.5">
          <section className="flex flex-col items-center pt-[35px]">
            <img
              src="/images/about/icon_logo_jiwo.png"
              alt={t("about.appName")}
              className="h-[72px] w-[72px] rounded-[12px] object-cover"
            />
            <h1 className="mt-[5px] text-[24px] font-medium leading-[34px] text-text">
              {t("about.appName")}
            </h1>
            <p className="text-[14px] leading-[14px] text-text-muted">v0.1.0</p>
          </section>

          <section className="mt-[22px] overflow-hidden rounded-[12px] bg-surface shadow-[var(--mine-card-shadow)]">
            {legalLinks.map((item) => (
              <AboutListItem
                key={item.title}
                title={item.title}
                onClick={() => openExternalLink(item.url)}
              />
            ))}
            <AboutListItem
              title={t("about.appReview")}
              rightLabel={t("about.appReviewTip")}
              onClick={() =>
                openExternalLink(
                  "https://apps.apple.com/app/id6480506979?action=write-review"
                )
              }
            />
            <AboutListItem
              title={t("about.contactAuthor")}
              description={t("about.contactAuthorDesc")}
              external
              onClick={() => openExternalLink("https://jiwo.cc/arkmets")}
            />
          </section>

          <footer className="mt-auto flex flex-col items-center pb-3 pt-10 text-center">
            <p className="text-[14px] leading-5 text-text-muted">
              {t("about.appName")}
            </p>
            <p className="text-[14px] leading-5 text-text-muted">
              {t("about.socialChannels")}
            </p>
            <div className="mt-[11px] flex items-center justify-center gap-2.5">
              {runLinks.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-[0.96]"
                  onClick={() => openExternalLink(item.url)}
                  aria-label={item.title}
                >
                  <img src={item.icon} alt="" className="h-9 w-9" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mt-[42px] space-y-0.5">
              {footerRecords.map((record) => (
                <p
                  key={record}
                  className="px-2 text-[10px] leading-4 text-text-disabled"
                >
                  {record}
                </p>
              ))}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function AboutListItem({
  title,
  description,
  rightLabel,
  external,
  onClick,
}: {
  title: string;
  description?: string;
  rightLabel?: string;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-[50px] w-full items-center border-b border-border-light px-3 text-left last:border-b-0 transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-5 text-text">{title}</p>
        {description && (
          <p className="mt-0.5 truncate text-xs leading-4 text-text-tertiary">
            {description}
          </p>
        )}
      </div>
      {rightLabel && (
        <span className="ml-2 max-w-[128px] truncate text-sm leading-5 text-text-tertiary">
          {rightLabel}
        </span>
      )}
      {external ? (
        <ExternalLinkIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
      ) : (
        <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
      )}
    </button>
  );
}

function MineActionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[74px] rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] px-3 pb-2.5 pt-2.5 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
    >
      <h2 className="text-base font-bold leading-6 text-text">{title}</h2>
      <p className="mt-px text-sm leading-5 text-text-tertiary">{description}</p>
    </button>
  );
}

function SettingsScreen({
  onBack,
  onOpenAppearance,
}: {
  onBack: () => void;
  onOpenAppearance: () => void;
}) {
  const { localeCode, resolvedLocale, t } = usePreferences();
  const [showLanguageSheet, setShowLanguageSheet] = React.useState(false);

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("settings.title")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <div className="overflow-hidden rounded-[12px] bg-surface">
          <SettingsListItem
            title={t("settings.appearance")}
            description={t("settings.appearanceDesc")}
            onClick={onOpenAppearance}
          />
          <SettingsListItem
            title={t("settings.language")}
            description={`${t("settings.current")}：${
              localeCode === ""
                ? t("settings.followSystem")
                : getLocaleDisplayName(localeCode, resolvedLocale)
            }`}
            onClick={() => setShowLanguageSheet(true)}
          />
        </div>
      </div>

      {showLanguageSheet && (
        <LanguageSheet onClose={() => setShowLanguageSheet(false)} />
      )}
    </div>
  );
}

function AppearanceStyleScreen({ onBack }: { onBack: () => void }) {
  const {
    accentColor,
    appIcon,
    isVip,
    resolvedTheme,
    setAccentColor,
    setAppIcon,
    setThemeMode,
    t,
    themeMode,
  } = usePreferences();
  const [limitMessage, setLimitMessage] = React.useState("");
  const themeOptions: Array<{ value: ThemeMode; label: string; preview: ResolvedTheme }> = [
    { value: "system", label: t("appearance.themeSystem"), preview: resolvedTheme },
    { value: "light", label: t("appearance.themeLight"), preview: "light" },
    { value: "dark", label: t("appearance.themeDark"), preview: "dark" },
  ];
  const iconOptions: Array<{ value: AppIcon; label: string; vip?: boolean }> = [
    { value: "classic", label: t("appearance.iconClassic") },
    { value: "bright", label: t("appearance.iconBright"), vip: true },
  ];

  const trySetAccentColor = (value: AccentColor) => {
    setLimitMessage("");
    setAccentColor(value);
  };

  const trySetAppIcon = (value: AppIcon, needsVip?: boolean) => {
    if (needsVip && !isVip) {
      setLimitMessage(t("appearance.freeLimit"));
      return;
    }
    setLimitMessage("");
    setAppIcon(value);
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("appearance.title")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        <section className="rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.theme")}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setThemeMode(option.value)}
                className={cn(
                  "rounded-[10px] border px-2 pb-2 pt-2 text-left transition active:scale-[0.98]",
                  themeMode === option.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface"
                )}
              >
                <ThemePreview mode={option.preview} />
                <p className="mt-2 truncate text-center text-xs font-medium text-text">
                  {option.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.accent")}
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {accentColorOptions.map((option) => {
              const active = accentColor === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => trySetAccentColor(option.key)}
                  className={cn(
                    "relative flex min-h-[74px] flex-col items-center justify-center rounded-[10px] border bg-surface transition active:scale-[0.98]",
                    active ? "border-primary" : "border-border"
                  )}
                >
                  <span
                    className="h-7 w-7 rounded-full border-[3px]"
                    style={{
                      backgroundColor: option.color,
                      borderColor: active ? option.border : "transparent",
                    }}
                  />
                  <span className="mt-2 text-xs text-text">
                    {t(`accent.${option.key}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.icon")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {iconOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => trySetAppIcon(option.value, option.vip)}
                className={cn(
                  "relative flex min-h-[74px] items-center rounded-[10px] border bg-surface px-3 text-left transition active:scale-[0.98]",
                  appIcon === option.value ? "border-primary" : "border-border"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
                  <img
                    src={getJiwoLogoSrc(option.value, resolvedTheme)}
                    alt=""
                    className="w-8"
                  />
                </div>
                <span className="ml-3 text-sm font-medium text-text">{option.label}</span>
                {option.vip && !isVip && (
                  <span className="absolute right-2 top-2 rounded-full bg-vip px-1.5 py-0.5 text-[9px] leading-3 text-white">
                    {t("common.vip")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {limitMessage && (
          <p className="mt-3 rounded-[10px] bg-primary-soft px-3 py-2 text-xs leading-5 text-primary">
            {limitMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { localeCode, setLocaleCode, t } = usePreferences();

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label={t("common.done")}
      />
      <div className="relative max-h-[76%] overflow-hidden rounded-t-[22px] bg-surface shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div>
            <h2 className="text-lg font-semibold leading-6 text-text">
              {t("settings.language")}
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              {t("settings.languageSheetDesc")}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 items-center rounded-full px-3 text-sm font-medium text-primary transition hover:bg-hover-overlay active:scale-[0.98]"
            onClick={onClose}
          >
            {t("common.done")}
          </button>
        </div>

        <div className="max-h-[560px] overflow-y-auto px-2 pb-5">
          {supportedLocales.map((option) => {
            const active = option.code === localeCode;
            return (
              <button
                key={option.code || "system"}
                type="button"
                onClick={() => {
                  setLocaleCode(option.code as LocaleCode);
                  onClose();
                }}
                className="flex h-12 w-full items-center justify-between rounded-[10px] px-3 text-left transition hover:bg-bg active:scale-[0.99]"
              >
                <span className="text-[15px] leading-5 text-text">
                  {option.code === "" ? t("settings.followSystem") : option.displayName}
                </span>
                {active && (
                  <span className="text-sm font-semibold text-primary">
                    {t("common.selected")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsListItem({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[62px] w-full items-center border-b border-border-light px-3 text-left last:border-b-0 transition hover:bg-bg active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-5 text-text">{title}</p>
        <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
          {description}
        </p>
      </div>
      <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
    </button>
  );
}

function MobilePageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = usePreferences();

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="ml-1 truncate text-[17px] font-semibold leading-5 text-text">
        {title}
      </h1>
    </header>
  );
}

function ThemePreview({ mode }: { mode: ResolvedTheme }) {
  const isDark = mode === "dark";

  return (
    <div
      className={cn(
        "h-[58px] overflow-hidden rounded-[8px] border p-1.5",
        isDark ? "border-[#333] bg-[#111]" : "border-[#e6e6e6] bg-[#f6f6f6]"
      )}
    >
      <div
        className={cn(
          "h-2.5 w-10 rounded-full",
          isDark ? "bg-[#2d2d2d]" : "bg-white"
        )}
      />
      <div className="mt-2 flex gap-1">
        <span className="h-7 flex-1 rounded-[5px] bg-primary" />
        <span
          className={cn(
            "h-7 flex-1 rounded-[5px]",
            isDark ? "bg-[#242424]" : "bg-white"
          )}
        />
      </div>
    </div>
  );
}

function getTabLabel(page: PageType, t: ReturnType<typeof usePreferences>["t"]) {
  if (page === "records") return t("tabs.records");
  if (page === "arrange") return t("tabs.arrange");
  if (page === "insight") return t("tabs.insight");
  return t("tabs.mine");
}

function TabIcon({ page, active }: { page: PageType; active: boolean }) {
  const className = cn(
    "h-[18px] w-[18px]",
    active ? "text-text" : "text-text-tertiary"
  );

  if (page === "records") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M7 6.75H17M7 12H17M7 17.25H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4.75 6.75H4.76M4.75 12H4.76M4.75 17.25H4.76" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (page === "arrange") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4.5" y="6" width="15" height="13.5" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 4.75V7.25M16 4.75V7.25M4.5 10H19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (page === "insight") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M6 16.5L10 12.5L13 15.5L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 9H14.75M18 9V12.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19.5C6.7 16.9 9.05 15.5 12 15.5C14.95 15.5 17.3 16.9 18.5 19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function getJiwoLogoSrc(appIcon: AppIcon, resolvedTheme: ResolvedTheme) {
  if (appIcon === "bright" || resolvedTheme === "dark") {
    return "/images/logo-jiwo-green.svg";
  }
  return "/images/logo-jiwo.svg";
}

function formatRoundCount(count: number, label: string) {
  return /^[a-zA-Z]/.test(label) ? `${count} ${label}` : `${count}${label}`;
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.5 4.5H4.25A1.75 1.75 0 0 0 2.5 6.25v5.5c0 .97.78 1.75 1.75 1.75h5.5c.97 0 1.75-.78 1.75-1.75V9.5M8.5 2.5h5m0 0v5m0-5-6.25 6.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendToSelfIcon({ className }: { className?: string }) {
  const { resolvedTheme } = usePreferences();
  const src =
    resolvedTheme === "dark"
      ? "/images/icon_send_to_self_sidebar_dark.svg"
      : "/images/icon_send_to_self_sidebar.svg";

  return (
    <img src={src} alt="" className={className} aria-hidden="true" />
  );
}

function OverviewEntryTag({ label }: { label: string }) {
  return (
    <span className="ml-1.5 shrink-0 rounded-[10px] bg-[var(--overview-entry-tag-bg)] px-2 py-0.5 text-[10px] font-medium leading-[14px] text-text-tertiary">
      {label}
    </span>
  );
}
