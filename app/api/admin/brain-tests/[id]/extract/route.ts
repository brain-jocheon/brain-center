/**
 * 뇌기능검사 파일 자동 추출 API — 11단계(PDF/Excel/CSV), 12단계(이미지/스캔PDF), 관리자 전용
 * (뇌기능검사는 8단계부터 관리자 전용).
 * 서버가 Storage에서 파일을 내려받아 텍스트를 뽑아 raw_extracted에 저장한다.
 * [안전] 여기서 뽑은 값은 절대 자동으로 indicators(확정 수치)에 들어가지 않는다 — 사람이
 * 화면에서 골라야만 반영됨. 재추출해도 is_public_to_parent(학부모 공개 여부)는 절대 안 건드림
 * (8단계와 동일한 원칙 — status만 needs_review로 되돌아감).
 * [12단계/비용] 이미지·PDF를 Claude Vision으로 읽는 경로만 실제 AI 비용이 든다 — 그 경로일
 * 때만 레이트리밋을 걸고 ai_generation_logs에 기록한다(PDF 텍스트/Excel/CSV 추출은 여전히 무료).
 */
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { isFullAdmin, getCurrentActor } from "@/lib/auth";
import {
  getBrainTest, getChild, downloadBrainFile, findDuplicateBrainTestBySourceHash, updateBrainTest,
  logAiGeneration, countRecentAiGenerationsByStaff, hashAiInputSummary,
} from "@/lib/data";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX = 40;

function extFromPath(path: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(path);
  return m ? m[1].toLowerCase() : "";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { mode?: string } | null;
  const forceVision = body?.mode === "vision";

  const test = await getBrainTest(params.id);
  if (!test) {
    return NextResponse.json({ message: "뇌기능검사를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!test.fileStoragePath) {
    return NextResponse.json({ message: "첨부된 파일이 없습니다." }, { status: 400 });
  }

  const ext = extFromPath(test.fileStoragePath);
  const usesVision = IMAGE_EXTS.has(ext) || (ext === "pdf" && forceVision);

  const staffId = actor?.kind === "staff" ? actor.staffId : undefined;
  if (usesVision && staffId) {
    const recent = await countRecentAiGenerationsByStaff(staffId, RATE_LIMIT_WINDOW_MINUTES);
    if (recent >= RATE_LIMIT_MAX) {
      return NextResponse.json({ message: "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  }

  const buffer = await downloadBrainFile(test.fileStoragePath);
  const sourceFileHash = createHash("sha256").update(buffer).digest("hex");

  // [주의] pdf-parse가 끌고 오는 pdfjs-dist는 최상단에서 정적으로 import하면 라우트 모듈
  // 자체를 불러오는 시점(핸들러 실행 전)에 깨질 수 있어 여기서 동적 import로 감싼다 —
  // 실패해도 이 try/catch가 실제로 잡을 수 있게(정적 import는 여기서 못 잡음).
  let extractFromFile: typeof import("@/lib/extraction").extractFromFile;
  let textContainsName: typeof import("@/lib/extraction").textContainsName;
  try {
    ({ extractFromFile, textContainsName } = await import("@/lib/extraction"));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: `추출 모듈을 불러오지 못했습니다: ${message}` }, { status: 500 });
  }

  const result = await extractFromFile(buffer, ext, forceVision ? { mode: "vision" } : undefined);

  const inputSummaryHash = hashAiInputSummary([test.testType, test.testDate, ext]);

  if (result.status === "not_configured") {
    // [10/13단계와 동일 패턴] 시도 자체가 없었던 것으로 처리 — 로그 안 남김
    return NextResponse.json({ ok: false, reason: "not_configured", message: "AI 기능이 아직 설정되지 않았습니다. 직접 입력해 주세요." });
  }

  if (result.status === "error") {
    await updateBrainTest(params.id, { status: "failed" });
    if (usesVision) {
      try {
        await logAiGeneration({
          feature: "vision_extraction", targetId: params.id, staffId, inputSummaryHash,
          status: "failed", errorMessage: result.message,
        });
      } catch {
        // [주의] ai_generation_logs.feature 체크 제약이 아직 마이그레이션 전이어도(12단계 신규
        // 값) 실제 추출 실패 응답 자체는 막지 않음 — 로그는 부가정보일 뿐이므로.
      }
    }
    return NextResponse.json({ ok: false, message: result.message });
  }

  const duplicateOfId = await findDuplicateBrainTestBySourceHash(test.childId, sourceFileHash, params.id);
  const child = await getChild(test.childId);
  const nameFound = child ? textContainsName(result.rawExtracted, child.name) : true;

  await updateBrainTest(params.id, {
    rawExtracted: result.rawExtracted,
    extractionConfidence: result.confidence,
    sourceFileHash,
    status: "needs_review",
  });

  if (usesVision) {
    try {
      await logAiGeneration({
        feature: "vision_extraction", targetId: params.id, staffId,
        model: result.rawExtracted.type === "vision" ? result.rawExtracted.model : undefined,
        inputSummaryHash, status: "success",
      });
    } catch {
      // [주의] 위와 동일 — 마이그레이션 전이어도 추출 성공 응답은 그대로 나가야 함
    }
  }

  return NextResponse.json({
    ok: true,
    rawExtracted: result.rawExtracted,
    confidence: result.confidence,
    duplicateWarning: duplicateOfId ? "같은 파일이 이미 이 아이의 다른 검사에 등록되어 있습니다. 중복 업로드가 아닌지 확인해 주세요." : undefined,
    nameMismatchWarning: !nameFound ? `추출된 내용에서 '${child?.name}' 이름을 찾지 못했습니다. 다른 아이의 검사지가 아닌지 확인해 주세요.` : undefined,
  });
}
