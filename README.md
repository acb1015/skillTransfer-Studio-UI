# skillTransfer Studio UI

Hugging Face `lerobot==0.4.4` (`LeRobotDataset v3.0`)의 데이터 수집(`lerobot-record`), 하드웨어 캘리브레이션, 텔레오퍼레이션, 데이터셋 편집, 정책 학습·평가, 비동기 추론까지 전 기능을 웹 브라우저에서 제어·검증·실행할 수 있도록 설계된 **Pure Black & White 모노크롬 웹 스튜디오 & Python FastAPI 브릿지**입니다.

## 주요 특징

- **깔끔한 Black & White 모노크롬 집중형 UI**:
  - 밝은 화이트/라이트 그레이(`#FFFFFF` / `#FAFAFA`) 배경과 제트 블랙(`#09090B`) 컨트롤러 구성, 녹화(`RECORDING`) 순간에만 점등되는 선명한 레드 REC 탈리(`#DC2626`) 인디케이터 제공
  - 메인 스테이지에는 **듀얼 카메라 + 트랜스포트 컨트롤 덱**만 배치하고, 상세 `RecordConfig`/`DatasetRecordConfig` 및 CLI·Python 생성기는 우측 슬라이드 드로어(`수집 설정 · CLI`)로 분리
- **실전 데이터 수집에 맞춘 통합 Reset 워크플로우 (`lerobot-record`)**:
  - 녹화 중 **조기종료(`→`)**: 현재 에피소드를 저장한 뒤 자동으로 **환경 Reset 타이머** 진입
  - 녹화 중 **폐기(`←`)**: 실수한 에피소드를 폐기한 뒤 물체를 원위치할 수 있도록 자동으로 **환경 Reset 타이머** 진입
  - Reset 중 **`▶ 지금 바로 기록 시작 (→)`**: 남은 Reset 대기 시간을 건너뛰고 즉시 다음(또는 재녹화) 에피소드 기록 시작
- **`lerobot` 미설치 환경 즉시 실행 & 실기기 설치 환경 자동 연동**:
  - `lerobot`이 설치되지 않은 환경에서는 내장 30Hz 로봇 관절/액션 시뮬레이션 브릿지로 동작하며, 로봇 PC에 `lerobot==0.4.4`가 설치되어 있으면 런타임에서 자동 감지
- **`lerobot==0.4.4` 전 기능 지원**:
  1. 데이터 수집 스튜디오 (`lerobot-record` — Teleop / Policy 평가 / HIL 개입 모드)
  2. 하드웨어 & 캘리브레이션 (`lerobot-find-port`, `lerobot-setup-motors`, `lerobot-calibrate`, `lerobot-find-cameras`, `lerobot-find-joint-limits`)
  3. 텔레오퍼레이션 & 에피소드 리플레이 (`lerobot-teleoperate`, `lerobot-replay`)
  4. 데이터셋 v3.0 편집 & 증강 프리뷰 (`lerobot-edit-dataset`, `lerobot-dataset-viz`, `lerobot-imgtransform-viz`)
  5. 정책 학습 & 시뮬레이션 평가 (`lerobot-train`, `lerobot-eval` — ACT, Diffusion, SmolVLA, π₀/π₀.₅, GR00T N1.5, HIL-SERL 등)
  6. 비동기 추론 gRPC 서버/클라이언트 & 진단 (`lerobot.async_inference.policy_server`, `robot_client`, `lerobot-info`)

## 디렉토리 구조

```text
.
├── backend/
│   ├── server.py               # FastAPI + 30Hz WebSocket 브릿지 & 통합 Reset 상태 머신
│   └── lerobot_v044_schema.py  # LeRobot v0.4.4 전체 카탈로그 & draccus CLI/Python 생성기
├── frontend/
│   ├── index.html              # skillTransfer Studio 메인 웹 콘솔
│   ├── styles.css              # Pure Black & White 모노크롬 스타일시트
│   └── app.js                  # WebSocket 클라이언트, 캔버스 렌더러 & 단축키 컨트롤러
├── standalone_preview.html     # 서버 없이 단일 파일로 바로 열어볼 수 있는 스탠드얼론 프리뷰
└── requirements.txt
```

## 빠른 실행 방법

```bash
pip install -r requirements.txt
uvicorn backend.server:app --host 0.0.0.0 --port 8765
```

실행 후 브라우저에서 `http://localhost:8765`로 접속합니다.
