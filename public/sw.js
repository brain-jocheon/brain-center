// 학습심리브레인센터 — 홈 화면 설치(PWA) 가능 조건을 만족시키기 위한 최소 서비스워커.
// [주의] 이 앱은 출결·활동사진·검사결과 등 항상 최신 데이터를 보여줘야 하므로
// 아무 것도 캐시하지 않습니다 — 모든 요청은 그대로 네트워크로 통과시킵니다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
