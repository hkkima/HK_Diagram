# HK_Diagram

🔗 **온라인 에디터: https://hkkima.github.io/HK_Diagram/**


Mermaid 코드를 받아 **직교(수직/수평) 라우팅** SVG + PNG로 렌더하는 도구.
표준 mermaid와 달리 UML에서 흔한 "부모 트렁크 → 공유 수평 버스 → 자식 분기"
도식화 규칙을 지킨다. 첨부 레퍼런스(UML 클래스/객체) 그래픽 스타일에 맞춤.

## 현재 범위 (MS1~MS3)
- `classDiagram` — 클래스 박스(3분할) + 객체/인스턴스 박스, 직교 버스 라우팅
- `flowchart` / `graph` — TB/BT/LR/RL, 도형(rect/round/stadium/diamond/circle/cylinder/subroutine), 라벨, 역방향 엣지 채널 우회
- `stateDiagram-v2` — 초기/종료 마커, 라운드 상태, 전이 라벨
- `erDiagram` — 엔티티 테이블(PK/FK), 까마귀발 카디널리티
- `sequenceDiagram` — 참가자·라이프라인·메시지(실선/점선·화살촉)·노트·loop/alt/opt 프레임
- 공통: 자동 색 팔레트, CLI + 로컬 웹 라이브 프리뷰(예제 전환)
- **양방향 편집(MS4)**: 캔버스에서 노드 클릭→편집(이름·내용·도형·속성), 추가/삭제.
  모든 편집이 mermaid 코드로 역생성되고, 코드를 직접 고치면 즉시 다이어그램에 반영(IR↔text 라운드트립).
  - **노드 드래그 = 자유 이동(배치 자유도)**. 위치는 `%% hkpos <id> <x> <y>` 주석으로 저장돼
    라운드트립된다(표준 mermaid는 주석으로 무시). 이동한 노드는 고정, 나머지는 자동 배치.
  - **노드 선택 시 우측 초록 핸들 드래그 = 연결** (러버밴드 선 + 드롭 타깃 하이라이트, Esc 취소)
  - **연결선 클릭 = 선택** → 패널에서 관계 종류·라벨 변경, 삭제(또는 Del/Backspace)
    - 클래스: 상속 `<|--` / 실현 `<|..` / 의존 `<..` / 연관 `<--`
    - 플로우차트: 선 종류(실선·점선·굵게) + 화살표 유무 + 라벨
    - ERD: 양 끝 카디널리티(정확히1·0/1·0/다·1/다) + 실선/점선 + 라벨
    - (시퀀스 메시지 편집은 코드에서)

flowchart/state/ERD는 공용 계층 레이아웃(`layout-graph`) + 직교 라우터(`route-graph`)를
공유한다. sequence는 시간축 모델이라 별도(`render-sequence`).

자유 이동 좌표는 `%% hkpos` 주석으로 보존되고, 라우터는 어느 위치에서도 직교(수직/수평)로 재연결한다.
구조 편집(이름·내용·도형·관계·추가/삭제)도 항상 코드로 정확히 환원.

## 설치
```
npm install
```

## CLI
```
node bin/cli.js examples/character.mmd -o out/character
# -> out/character.svg, out/character.png
```
옵션: `--scale N`(PNG 배율, 기본 2), `--no-png`, `-o <basename>`.

## 웹 프리뷰
```
node web/server.js     # http://localhost:5178
```
왼쪽 코드 입력 → 오른쪽 즉시 렌더, SVG/PNG 저장 버튼.

## 입력 규칙 (MS1)

표준 mermaid `classDiagram` 문법을 쓴다. 추가 규약:

| 쓰면 | 해석 |
|------|------|
| `class Foo { +x: int \n +M() }` | 클래스 박스. `()` 있는 멤버는 메서드 칸, 없으면 속성 칸 |
| `<<공통 정보>>` | **본문 내 그룹 구분선**(가운데 이탤릭 밴드). 필드를 사람이 식별하기 좋게 묶는 용도(클래스/객체 단위 스테레오타입 아님). 그룹이 없으면 속성/메서드 자동 구분선 |
| `class hero { name = "용사" }` | `=` 가 있는 멤버가 하나라도 있으면 **객체 박스**(밑줄 제목 + 값 목록) |
| `Player <.. hero` | 점선 인스턴스 관계. 객체 `hero` 의 타입 = `Player`, 제목은 `hero : Player`, 색은 타입별 자동 팔레트 |
| `A <\|-- B` | 실선 상속 (A=부모 위, B=자식 아래) |
| `A <\|.. B` | 점선 실체화 |

부모/자식(위/아래)은 관계 화살표 방향으로 정해진다.

## 구조
```
src/render.js        타입 감지 + renderToSVG (브라우저-안전 엔트리)
src/index.js         renderMermaid(text) = SVG + PNG (node 전용)
src/png.js           SVG -> PNG (resvg, 시스템 폰트)

class/object:
  parse-class · layout-class(계층 트리) · route-ortho(버스) · render-svg
flowchart/state (공용 그래프 코어):
  parse-flowchart · parse-state · shapes · layout-graph(Sugiyama-lite+더미)
  · route-graph(직교) · render-graph
ERD:
  parse-er · render-er(layout-graph 재사용 + 까마귀발)
sequence:
  parse-sequence · render-sequence(시간축 모델)

양방향 편집(MS4):
  ir.js(parseAny: text→IR) · serialize.js(IR→mermaid, +%% hkpos) · edit-ops.js(IR 변형)
  layout-util.js(applyPositions: 자유배치 오버라이드) · render.js(parsePositions)
  web/editor.js(노드 선택·자유이동·핸들 연결, 연결선 선택·편집, 클래스 본문 그룹 편집)
  렌더러는 노드에 data-id, 연결선에 data-edge(+투명 hit 패스) 부착해 클릭 매핑
```
