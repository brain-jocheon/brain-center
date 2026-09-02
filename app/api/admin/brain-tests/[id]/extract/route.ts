/**
 * 뇌기능검사 파일 자동 추출 API — 11단계, 관리자 전용(뇌기능검사는 8단계부터 관리자 전용).
 * 서버가 Storage에서 파일을 내려받아 PDF/Excel/CSV 텍스트를 뽑아 raw_extracted에 저장한다.
 * [안전] 여기서 뽑은 값은 절대 자동으로 indicators(확정 수치)에 들어가지 않는다 — 사람이
 * 화면에서 골라야만 반영됨. 재추출해도 is_public_to_parent(학부모 공개 여부)는 절대 안 건드림
 * (8단계와 동일한 원칙 — status만 needs_review로 되돌아감).
 */
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { isFullAdmin, getCurrentActor } from "@/lib/auth";
import { getBrainTest, getChild, downloadBrainFile, findDuplicateBrainTestBySourceHash, updateBrainTest } from "@/lib/data";
import { extractFromFile, textContainsName } from "@/lib/extraction";

function extFromPath(path: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(path);
  return m ? m[1].toLowerCase() : "";
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const test = await getBrainTest(params.id);
  if (!test) {
    return NextResponse.json({ message: "뇌기능검사를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!test.fileStoragePath) {
    return NextResponse.json({ message: "첨부된 파일이 없습니다." }, { status: 400 });
  }

  const buffer = await downloadBrainFile(test.fileStoragePath);
  const sourceFileHash = createHash("sha256").update(buffer).digest("hex");
  const ext = extFromPath(test.fileStoragePath);

  const result = await extractFromFile(buffer, ext);

  if (result.status === "error") {
    await updateBrainTest(params.id, { status: "failed" });
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

  return NextResponse.json({
    ok: true,
    rawExtracted: result.rawExtracted,
    confidence: result.confidence,
    duplicateWarning: duplicateOfId ? "같은 파일이 이미 이 아이의 다른 검사에 등록되어 있습니다. 중복 업로드가 아닌지 확인해 주세요." : undefined,
    nameMismatchWarning: !nameFound ? `추출된 내용에서 '${child?.name}' 이름을 찾지 못했습니다. 다른 아이의 검사지가 아닌지 확인해 주세요.` : undefined,
  });
}
