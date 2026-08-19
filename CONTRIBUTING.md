# Contributing

기능 변경은 작은 모듈과 해당 동작을 직접 검증하는 테스트를 함께 추가합니다.

1. Node.js 22 LTS에서 `npm ci`를 실행합니다.
2. 파서와 SVG 생성은 `src/latex/`, Excalidraw DOM 연결은 `src/excalidraw/`에 둡니다.
3. 페이지 내부 React 객체나 비공개 전역 API에는 의존하지 않습니다.
4. `npm run verify`가 통과하는지 확인합니다.

수식 원문 메타데이터를 변경할 때는 기존 `LatexMetadataV1`을 덮어쓰지 말고 새 버전 타입과 호환 테스트를 추가합니다.
