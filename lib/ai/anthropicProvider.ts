/**
 * AI 서비스 계층 — 10단계. 서버에서만 호출(클라이언트에 키 노출 없음).
 * [설계] ANTHROPIC_API_KEY가 없으면 네트워크 호출 자체를 안 하고 즉시 "준비중"으로 응답 —
 * 키가 없어도 수동 입력 흐름은 전혀 안 깨짐. Anthropic Messages API를 순수 fetch로 직접 호출해
 * SDK 의존성을 추가하지 않음(package.json 변경 없음).
 * [보안] 환경변수는 함수 안에서 지연 조회 — lib/data.ts의 db() 지연 싱글턴과 동일한 이유로,
 * 모듈 로드 시점(빌드/다른 라우트 import)에 죽지 않게.
 */
import type { ClassRecordDraftInput, ClassRecordDraftResult } from "./types";

const DEFAULT_MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = `당신은 아동 학습심리센터 선생님의 수업기록 작성을 돕는 보조 도구입니다.
반드시 아래 규칙을 지키세요:
1. 제공된 사실 정보(선생님 메모, 활동 정보, 아동 특성)만 사용하세요. 제공되지 않은 구체적 수치, 사건, 진단명, 검사 결과를 절대 지어내지 마세요.
2. 확실하지 않은 내용은 "오늘 관찰된 바로는" 같은 표현으로 완곡하게 쓰고 과장하지 마세요.
3. 세 가지를 각각 2~4문장으로 작성하세요:
   - detail: 선생님이 나중에 참고할 내부용 상세 기록(전문적이어도 됨)
   - parent: 학부모에게 그대로 보여줄 따뜻하고 이해하기 쉬운 코멘트(전문용어 지양)
   - guidance: 다음 수업에서 참고할 지도 방향 제안
4. 출력은 반드시 아래 JSON 형식 하나만 반환하세요. 마크다운 코드펜스나 다른 설명 텍스트를 절대 포함하지 마세요.
{"detail":"...","parent":"...","guidance":"..."}`;

function buildUserContent(input: ClassRecordDraftInput): string {
  const lines = [
    `아동 이름: ${input.childName}`,
    `활동: ${input.activityName} (${input.activityType})`,
    `날짜: ${input.classDate}`,
  ];
  if (input.lessonGoal) lines.push(`수업목표: ${input.lessonGoal}`);
  if (input.participation) lines.push(`참여도: ${input.participation}`);
  if (input.strengthsNote) lines.push(`잘한 점: ${input.strengthsNote}`);
  if (input.difficultiesNote) lines.push(`어려워한 점: ${input.difficultiesNote}`);
  if (input.traitsContext) lines.push(`아동 특성 참고: ${input.traitsContext}`);
  lines.push(`선생님 메모: ${input.teacherMemo}`);
  return lines.join("\n");
}

function parseDraftJson(text: string): { detail: string; parent: string; guidance: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const { detail, parent, guidance } = obj;
  if (typeof detail !== "string" || typeof parent !== "string" || typeof guidance !== "string") return null;
  if (!detail.trim() || !parent.trim() || !guidance.trim()) return null;
  return { detail: detail.trim(), parent: parent.trim(), guidance: guidance.trim() };
}

async function callAnthropic(apiKey: string, model: string, userContent: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateClassRecordDraft(input: ClassRecordDraftInput): Promise<ClassRecordDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const userContent = buildUserContent(input);

  let res: Response;
  try {
    res = await callAnthropic(apiKey, model, userContent);
    if (!res.ok && res.status >= 500) {
      // 일시적 서버 오류로 간주 — 1회만 재시도
      res = await callAnthropic(apiKey, model, userContent);
    }
  } catch {
    try {
      res = await callAnthropic(apiKey, model, userContent);
    } catch {
      return { status: "error", message: "AI 서버에 연결하지 못했습니다." };
    }
  }

  if (!res.ok) {
    return { status: "error", message: `AI 요청이 실패했습니다. (상태 ${res.status})` };
  }

  const data = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
    | null;
  const text = data?.content?.find((c) => c.type === "text")?.text;
  if (!text) {
    return { status: "error", message: "AI 응답을 읽을 수 없습니다." };
  }

  const draft = parseDraftJson(text);
  if (!draft) {
    return { status: "error", message: "AI 응답 형식이 올바르지 않습니다." };
  }

  const tokensUsed =
    data?.usage?.input_tokens != null && data?.usage?.output_tokens != null
      ? data.usage.input_tokens + data.usage.output_tokens
      : undefined;

  return { status: "ok", ...draft, model, tokensUsed };
}
