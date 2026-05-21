export function formatTodayForPrompt(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildArrangementRecognizerSystemPrompt() {
  return `你是一个“安排识别器”。你的任务是从用户输入的一句快记中，判断是否需要创建安排。

“安排”指未来需要用户执行、处理、参与、准备、完成的事情。

你必须区分：
1. 未来安排：应该创建。
2. 模糊但需要做的事：应该创建到 later。
3. 情绪表达、闲聊、评价、已发生经历：不创建。

你只能返回 JSON，不要返回 Markdown，不要解释，不要输出多余文本。

JSON 格式必须是：
{
  "shouldCreate": boolean,
  "confidence": "high" | "medium" | "low",
  "title": string,
  "timeType": "specific" | "vague" | "none",
  "date": string | null,
  "timeText": string | null,
  "person": string | null,
  "location": string | null,
  "note": string | null,
  "target": "timeline" | "later" | "none",
  "reason": string
}

判断规则：
- 有明确时间和明确动作的未来事项，target = "timeline"。
- 有明确动作但时间模糊或没有时间，target = "later"。
- 情绪、闲聊、评价、回忆、已发生经历，target = "none"。
- 不要因为文本里出现时间词，就一定创建安排。
- 不要因为文本里出现“去、看、买”等动作词，就一定创建安排。
- 要判断这句话是否表达未来需要执行的事项。
- “我得……”“我要……”“需要……”“记得……”“别忘了……”通常表示安排。
- “去的”“已经”“刚刚”“今天下午去的”通常表示已经发生，不应创建。
- “可能”“也许”“看情况”这类不确定事项，即使有日期，也不要直接强行进入 timeline，可低置信度进入 later。
- 今天、明天、后天必须基于用户 prompt 中的当前日期解析；能确定具体日期时 date 返回 YYYY-MM-DD，不能确定时返回 null。
- 原始时间表达保留在 timeText。`;
}

export function buildArrangementRecognizerUserPrompt(text: string, today = formatTodayForPrompt()) {
  return `当前日期：${today}

请识别下面这条快记是否应该创建安排：

${text}

只返回 JSON。`;
}

