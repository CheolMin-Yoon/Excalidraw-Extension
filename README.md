# Excalidraw Vector LaTeX

`$$...$$`로 입력한 LaTeX 수식을 Excalidraw에 **투명한 벡터 SVG**로 넣어주는 Chrome 확장입니다.

- 흰색 배경 없음
- 확대해도 깨지지 않는 SVG 출력
- 외부 서버나 원격 코드 없이 브라우저 안에서만 렌더링
- 향후 재편집 기능을 위한 LaTeX 원문 메타데이터 포함

## 사용법

1. Excalidraw에서 텍스트 도구를 선택합니다.
2. 텍스트 전체를 `$$\frac{a}{b}$$`처럼 입력합니다.
3. 캔버스를 클릭하거나 다른 곳으로 포커스를 옮깁니다.
4. 원래 텍스트가 제거되고 같은 수식의 투명 SVG가 삽입됩니다.

여러 줄 수식도 사용할 수 있습니다.

```latex
$$
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$
```

잘못된 LaTeX는 이미지로 바꾸지 않으며 원문을 그대로 보존합니다. 일반 문장 속의 `$$...$$`, 빈 수식, 여러 수식 블록은 v1에서 자동 변환하지 않습니다.

## 로컬 설치

현재 Chrome Web Store에는 등록되어 있지 않습니다.

1. [Releases](../../releases)가 있다면 최신 ZIP을 받아 압축을 풉니다. 소스에서 설치한다면 아래 개발 빌드를 먼저 실행합니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. 오른쪽 위의 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다**를 누르고 `dist/` 폴더를 선택합니다.

Edge는 `edge://extensions`, Brave는 `brave://extensions`에서 같은 방식으로 설치할 수 있습니다.

## Chrome Web Store 배포(선택)

직접 사용하거나 개발하는 동안에는 Web Store 등록이 필요하지 않습니다. 다른 사용자가 Chrome Web Store에서 검색하고 한 번에 설치하게 하려면 다음 작업이 별도로 필요합니다.

1. [Chrome Web Store 개발자 계정](https://developer.chrome.com/docs/webstore/register)을 등록하고 일회성 등록비를 결제합니다.
2. `dist/`의 내용물을 `manifest.json`이 ZIP 최상단에 오도록 압축합니다.
3. 개발자 대시보드에 ZIP, 설명, 스크린샷·홍보 이미지, 개인정보 처리방침 URL을 등록합니다.
4. Privacy practices의 데이터 처리·권한 사용 내용을 작성하고 심사를 요청합니다.

기존 Excalidraw 확장 프로그램이나 해당 Web Store 페이지에서 파일을 내려받을 필요는 없습니다. 이 저장소의 빌드 결과가 독립적인 새 확장 프로그램입니다.

## 개발

Node.js 22 LTS와 npm을 사용합니다.

```bash
npm ci
npm run verify
```

주요 명령은 다음과 같습니다.

- `npm run dev`: 파일 변경 시 확장 번들을 다시 빌드
- `npm test`: 파서·SVG 렌더러·Excalidraw 연동 테스트
- `npm run build`: `dist/`에 로드 가능한 확장 생성
- `npm run verify`: 타입 검사, lint, 테스트, 빌드를 순서대로 실행

실제 Chrome for Testing에서 Excalidraw 연동 smoke test를 실행하려면 브라우저를 한 번 설치한 뒤 테스트합니다.

```bash
npx playwright install chromium
npm run test:smoke
```

이미 설치한 Chrome 계열 브라우저를 사용하려면 `CHROME_PATH`에 실행 파일 경로를 지정할 수 있습니다.

구조는 역할별로 분리되어 있습니다.

- `src/latex/`: `$$...$$` 파싱, MathJax SVG 렌더링, 메타데이터 계약
- `src/excalidraw/`: 텍스트 편집기와 SVG 붙여넣기 연결
- `src/controller.ts`: 포커스·입력 이벤트와 실패 복구 흐름
- `src/ui/`: 사용자 오류 알림

새 기능은 Excalidraw의 비공개 React 상태에 의존하지 않고 위 모듈 경계를 유지하는 것을 기본 원칙으로 합니다.

## 현재 제한

- `https://excalidraw.com/*`에서만 동작합니다.
- Chrome, Edge, Brave 등 Chromium 기반 브라우저만 지원합니다.
- v1의 수식 색상은 검은색이고 display mode로 고정됩니다.
- SVG에 원문은 저장되지만 재편집 UI는 아직 없습니다.

## 개인정보와 라이선스

확장은 수식이나 캔버스 데이터를 수집·저장·전송하지 않습니다. 자세한 내용은 [PRIVACY.md](PRIVACY.md)를 참고하세요.

프로젝트 코드는 [MIT License](LICENSE)로 배포됩니다. MathJax 관련 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
