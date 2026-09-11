# AI Provider 구조 점검 보고서

> 분석 전용 문서입니다. 이번 점검에서 코드는 전혀 수정하지 않았습니다.

작성일: 2026-09-11

---

## 결론 요약

**지금 구조는 "AI 기능 → 공통 Provider Interface → Anthropic/OpenAI 등 Provider" 형태가 아닙니다.** 정확히는:

- **입출력 타입(`lib/ai/types.ts`)은 이미 업체에 종속되지 않은 깨끗한 구조**입니다(좋은 부분).
- **하지만 그 타입을 실제로 구현하는 함수들은 전부 `anthropicProvider.ts` 한 파일에 있고, AI 기능을 쓰는 4곳이 전부 그 파일 경로를 직접 import**합니다(공통 인터페이스를 거치지 않고 구체적인 구현에 바로 의존). 그래서 다른 업체(OpenAI 등)를 추가하려면 지금은 4곳의 import 경로를 전부 고쳐야 합니다.
- 다행히 **결합도가 아주 심각한 수준은 아닙니다** — 대규모 리팩토링 없이 파일 1개 추가 + import 경로 4줄 수정 정도로 최소한의 Provider 교체 구조를 만들 수 있습니다(아래 3번 참고). **이번엔 제안만 드리고 코드는 고치지 않았습니다.**

---

## 1. 현재 구조를 실제로 확인한 내용

### 파일 구조
```
lib/ai/
├── types.ts              — 기능별 입출력 타입 정의(업체 무관)
└── anthropicProvider.ts   — 실제 구현 전부(19.6KB, 4개 AI 기능 함수 + Anthropic 전용 HTTP 호출 로직)
```
`lib/ai/` 폴더에는 이 두 파일만 있습니다. `provider.ts`, `index.ts`, `AIProvider` 인터페이스 같은 추상화 계층은 **존재하지 않습니다.**

### `lib/ai/types.ts` — 이미 업체 중립적 (재사용 가능)
4개 기능의 입출력 타입이 정의돼 있습니다:
- `ClassRecordDraftInput/Result` (수업기록 3분할 초안 — 10단계)
- `EegInterpretationInput/Result` (뇌기능검사 해석 — 13단계)
- `VisionExtractionInput/Result` (이미지/스캔PDF 인식 — 12단계)
- `ParentCommentDraftInput/Result` (학부모 코멘트 5분할 초안 — 16단계, 방금 만든 기능)

전부 순수 문자열/숫자/JSON 형태이고, Anthropic 고유의 필드(예: `content block`, `model` 파라미터 형식 등)는 전혀 섞여 있지 않습니다. **이 부분은 이미 어떤 업체를 붙여도 그대로 쓸 수 있는 구조입니다.**

### `anthropicProvider.ts` — 실제 구현이 전부 여기, export된 함수 4개
```ts
export async function generateClassRecordDraft(input: ClassRecordDraftInput): Promise<ClassRecordDraftResult>
export async function generateParentCommentDraft(input: ParentCommentDraftInput): Promise<ParentCommentDraftResult>
export async function generateEegInterpretation(input: EegInterpretationInput): Promise<EegInterpretationResult>
export async function extractViaVision(input: VisionExtractionInput): Promise<VisionExtractionResult>
```
이 4개 함수 각각의 내부에서:
- `process.env.ANTHROPIC_API_KEY`를 **함수 안에서 그때그때 읽음**(4곳에 중복, 모듈 로드 시점이 아니라 호출 시점에 읽어서 키가 없어도 앱이 안 죽음 — 이건 잘 설계된 부분입니다).
- Anthropic 전용 저수준 호출 함수(`callAnthropic`/`callAnthropicWithRetry`, 비공개)를 호출 — 여기서 `https://api.anthropic.com/v1/messages` 엔드포인트, `x-api-key` 헤더, `anthropic-version` 헤더 등 Anthropic Messages API 고유 형식을 그대로 씁니다.
- 이미지/PDF를 다루는 `AnthropicContentBlock` 타입(`type: "image"|"document"`, `source: {type:"base64", media_type, data}` 형식)도 Anthropic Messages API 고유 형식이지만, **이 타입은 export되지 않은 비공개 타입**이라 호출하는 쪽(`extractViaVision`을 부르는 `lib/extraction/parseVision.ts`)은 이 형식을 몰라도 됩니다 — `VisionExtractionInput`(base64, mediaType, kind)만 넘기면 됩니다. **이 부분도 이미 잘 캡슐화돼 있습니다.**

### 실제로 이 파일을 가져다 쓰는 4곳 — 전부 구체 파일 경로를 직접 import
| 파일 | import 문 |
|---|---|
| `app/api/admin/ai/class-record-draft/route.ts` | `import { generateClassRecordDraft } from "@/lib/ai/anthropicProvider";` |
| `app/api/admin/ai/parent-comment-draft/route.ts` | `import { generateParentCommentDraft } from "@/lib/ai/anthropicProvider";` |
| `app/api/admin/brain-tests/[id]/interpret/route.ts` | `import { generateEegInterpretation } from "@/lib/ai/anthropicProvider";` |
| `lib/extraction/parseVision.ts` | `import { extractViaVision } from "../ai/anthropicProvider";` |

**바로 이 부분이 핵심 문제입니다** — 4곳 전부 파일 이름 자체가 `anthropicProvider`인 경로를 직접 가리킵니다. 나중에 "다원재능 해석"/"BQ2 해석"/"전후비교"/"변화보고서" 같은 새 AI 기능을 추가할 때마다 이 패턴(구체 파일을 직접 import)이 계속 반복되면, 나중에 업체를 바꾸거나 병행 운영(예: 기능별로 다른 업체 사용)하려 할 때 손대야 할 지점이 계속 늘어납니다.

---

## 2. 종합 평가

| 항목 | 상태 |
|---|---|
| 기능별 입출력 타입이 업체 중립적인가 | ✅ 예 (`lib/ai/types.ts`) |
| 이미지/문서 등 업체 고유 데이터 형식이 호출부에 노출되는가 | ✅ 노출 안 됨(비공개 타입으로 캡슐화됨) |
| API 키를 여러 곳에서 안전하게(지연) 읽는가 | ✅ 예(함수 내부에서 매번 읽음, 모듈 로드 시 죽지 않음) |
| **AI 기능(API 라우트)이 공통 인터페이스를 거쳐 Provider를 호출하는가** | ❌ 아니오 — 구체 파일을 직접 import |
| Provider를 교체/추가하려면 몇 곳을 고쳐야 하는가 | 지금은 **4곳**(기능이 늘어날수록 계속 증가) |

**"코드가 이미 Provider 교체가 쉬운 구조냐"는 질문에 대한 답: 절반만 그렇습니다.** 데이터 형태(타입)는 이미 교체하기 좋게 되어 있지만, 실제 호출 경로(어디서 어떤 파일을 import하는지)는 아직 Anthropic에 직접 묶여 있습니다.

---

## 3. 최소 변경 제안 (제안만 — 이번에 적용하지 않음)

대규모 리팩토링 없이, 아래처럼 **얇은 재수출(re-export) 계층 하나만 추가**하면 됩니다.

### 3-1. 새 파일 `lib/ai/index.ts` 추가(신규 파일 1개, 기존 파일 무수정)
```ts
// AI 기능(API 라우트)은 항상 이 파일에서만 import한다 — 구체 Provider 파일을 직접 가리키지 않는다.
export {
  generateClassRecordDraft,
  generateParentCommentDraft,
  generateEegInterpretation,
  extractViaVision,
} from "./anthropicProvider";
```

### 3-2. 기존 4곳의 import 경로만 수정 (한 줄씩, 로직 변경 없음)
`from "@/lib/ai/anthropicProvider"` → `from "@/lib/ai"`로 바꾸기만 하면 됩니다. 함수 이름·시그니처·동작은 전혀 안 바뀝니다.

### 3-3. 나중에 실제로 업체를 추가/교체할 때
1. `lib/ai/openaiProvider.ts`를 만들어 같은 4개 함수 이름·같은 입출력 타입으로 구현.
2. `lib/ai/index.ts`의 재수출 대상을 바꾸거나, 환경변수로 분기:
   ```ts
   const PROVIDER = process.env.AI_PROVIDER || "anthropic";
   export const { generateClassRecordDraft, ... } =
     PROVIDER === "openai" ? await import("./openaiProvider") : await import("./anthropicProvider");
   ```
3. **API 라우트 4곳, 타입 정의(`lib/ai/types.ts`)는 전혀 안 건드림.**

이 방식의 장점: 지금 당장은 파일 1개 추가 + import 문 4줄 수정이 전부라 위험이 거의 없고, 나중에 실제로 다른 업체가 필요해지는 시점에 딱 그때 가서 `openaiProvider.ts`만 새로 짜면 됩니다. 지금 당장 OpenAI 어댑터까지 미리 만들어두는 건 사용하지도 않을 코드를 유지보수해야 하는 과설계라 권장하지 않습니다.

### 참고: 이렇게 안 해도 지금 당장 문제가 생기진 않음
다원재능/BQ2/전후비교/변화보고서 기능도 **지금처럼 `anthropicProvider.ts`에 함수를 추가하고 그 경로를 직접 import하는 방식으로 계속 만들어도 당장 동작에는 문제가 없습니다.** 다만 그렇게 계속 쌓이면 나중에 "일부 기능만 다른 업체로 바꾸고 싶다"는 요구가 왔을 때 고쳐야 할 곳이 늘어나 있는 상태가 됩니다. 3-1/3-2번 변경은 지금 해두면 그 비용을 거의 0에 가깝게 만들어두는 "보험" 성격의 변경이라, 다음 AI 기능(다원재능 해석 등)을 만들기 **직전에** 적용하는 것을 권장합니다.

---

## 4. `ANTHROPIC_API_KEY`가 로드되는 정확한 위치

코드 전체를 검색한 결과, 이 환경변수를 읽는 곳은 **`lib/ai/anthropicProvider.ts` 안의 4개 함수, 딱 4줄**입니다(전부 `process.env.ANTHROPIC_API_KEY`를 함수 호출 시점에 직접 읽음 — 모듈 최상단이나 별도 config 파일에서 읽어 캐싱하는 방식이 아님). 코드 안에 실제 키 값이 하드코딩된 곳은 전혀 없습니다(전체 검색 결과 0건).

Next.js 프로젝트에서 `process.env.X`는 실행 환경이 넘겨주는 값을 그대로 읽는 것이라, **이 프로젝트 코드 자체는 "어디서 값이 오는지" 전혀 모릅니다** — 값은 아래 3곳 중 하나에서 주입됩니다.

---

## 5. 환경별 API Key 안전 관리 방법

### 로컬 개발환경
- `.env.local` 파일에 `ANTHROPIC_API_KEY=실제키값`으로 저장(이미 이 프로젝트의 다른 키들 — `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` 등 — 도 전부 이 파일에 있음, 동일한 방식 그대로 따르면 됨).
- 지금 실제로 `.gitignore`에 `.env*.local`과 `.env`가 등록되어 있어 **이 파일은 Git에 절대 커밋되지 않습니다**(확인 완료).
- `.env.example`(값 없이 변수 이름만 있는 파일, Git에 커밋되어 있음)에 이미 `ANTHROPIC_API_KEY=`와 `AI_MODEL=` 항목이 준비되어 있어, 나중에 다른 개발자/새 환경에서 어떤 변수가 필요한지 안내 역할을 합니다.
- Next.js는 `next dev`/`next start` 실행 시 `.env.local`을 자동으로 읽어 `process.env`에 채워줍니다 — 별도 로딩 코드가 필요 없습니다.

### 배포환경 (Vercel)
- 이 프로젝트는 Vercel + GitHub 자동배포 구조입니다. Vercel은 **저장소 안의 파일이 아니라 Vercel 프로젝트 설정 화면(Project → Settings → Environment Variables)에 등록한 값**을 빌드/실행 시점에 주입합니다.
- 저장소에는 `vercel.json` 같은 배포 설정 파일도 없음을 확인했습니다 — 즉 환경변수 관리는 전적으로 Vercel 대시보드에서만 이루어지고, 저장소 안 어디에도 실제 키 값이 존재하지 않는 구조입니다(안전).
- 등록 시 유의점: Production/Preview/Development 환경별로 따로 값을 넣을 수 있는데, 지금까지처럼 세 환경 모두 같은 운영 Supabase를 보고 있다면 `ANTHROPIC_API_KEY`도 세 환경 모두에 동일하게(또는 필요에 따라 Preview는 비워서 AI 기능이 "준비중"으로 폴백되게) 등록하시면 됩니다.
- **등록 후 별도 배포(재배포)가 있어야 반영됩니다** — Vercel은 환경변수를 바꾼 뒤 기존 배포에 즉시 핫스왑하지 않고, 다음 빌드부터 적용됩니다.

### Git 저장소
- 원칙: **API 키는 코드에도, 커밋 메시지에도, 어떤 파일에도 평문으로 들어가면 안 됩니다.** 지금까지 확인한 바로는 이 원칙이 잘 지켜지고 있습니다(`.env.local` gitignore 처리, 코드 내 하드코딩 0건).
- 혹시 실수로 키가 담긴 커밋이 만들어졌다면: 단순히 다음 커밋에서 지우는 것만으론 부족합니다(git 기록에 남음) — 그 경우 **즉시 Anthropic 콘솔에서 해당 키를 폐기(rotate)하고 새 키를 발급**하는 것이 유일하게 확실한 대응입니다. (지금은 이런 사고가 없었음을 확인했습니다 — 예방 차원의 참고사항입니다.)
- 협업자에게 "무슨 환경변수가 필요한지"는 `.env.example`로 공유하고, **실제 값은 절대 슬랙/이메일 등에 평문으로 보내지 말고** 필요하면 Vercel 대시보드에 직접 초대해서 등록하게 하는 방식을 권장합니다.

---

## 다음 지시를 기다립니다

이번 점검에서 AI 호출이나 코드 수정은 전혀 하지 않았습니다. 3번 제안(얇은 재수출 계층)을 지금 적용할지, 아니면 다음 AI 기능(다원재능 해석 등) 작업 직전에 적용할지 알려주시면 그에 맞춰 진행하겠습니다.
