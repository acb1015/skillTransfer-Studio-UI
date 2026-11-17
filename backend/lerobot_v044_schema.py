"""
LeRobot v0.4.4 Complete Schema & Registry Catalog
==================================================
Exact representation of LeRobot 0.4.4 CLI entrypoints, draccus ChoiceRegistry subclasses,
RecordConfig / DatasetRecordConfig fields, Dataset v3.0 edit tools, policies, environments,
and async inference server/client parameters.

Designed to run WITHOUT requiring `lerobot` to be installed, while automatically detecting
and bridging to `lerobot==0.4.4` when present in the Python environment.
"""

from __future__ import annotations

import importlib.metadata
import importlib.util
import platform
import shlex
import sys
from typing import Any


def detect_lerobot_runtime() -> dict[str, Any]:
    """Detect whether lerobot is installed on the host Python environment."""
    spec = importlib.util.find_spec("lerobot")
    installed = spec is not None
    detected_version = None
    if installed:
        try:
            detected_version = importlib.metadata.version("lerobot")
        except Exception:
            detected_version = "installed"

    torch_spec = importlib.util.find_spec("torch")
    return {
        "target_lerobot_version": "0.4.4",
        "lerobot_installed": installed,
        "detected_lerobot_version": detected_version,
        "bridge_mode": "live_hardware" if installed else "simulation_bridge",
        "dataset_format_version": "v3.0",
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "pytorch_installed": torch_spec is not None,
    }


# ---------------------------------------------------------------------------
# 1. CLI Entrypoints in LeRobot v0.4.4 (`pyproject.toml` [project.scripts])
# ---------------------------------------------------------------------------
CLI_COMMANDS_V044: list[dict[str, Any]] = [
    {
        "command": "lerobot-record",
        "module": "lerobot.scripts.lerobot_record",
        "category": "data_collection",
        "title": "데이터 수집 & 실기기 평가 기록",
        "description": "원격조작(Teleop), 사전학습 정책(Policy), 또는 HIL 개입 모드로 동기화된 멀티카메라 MP4 및 관절 상태/액션 Parquet(LeRobotDataset v3.0)를 기록합니다.",
    },
    {
        "command": "lerobot-teleoperate",
        "module": "lerobot.scripts.lerobot_teleoperate",
        "category": "control",
        "title": "실시간 텔레오퍼레이션",
        "description": "데이터 저장 없이 리더 암·게임패드·키보드·스마트폰으로 팔로워 로봇을 실시간 제어하고 카메라/관절 상태를 검증합니다.",
    },
    {
        "command": "lerobot-replay",
        "module": "lerobot.scripts.lerobot_replay",
        "category": "control",
        "title": "기록된 에피소드 재생",
        "description": "기존 LeRobotDataset의 특정 에피소드 액션 시퀀스를 실제 로봇에서 그대로 재현하여 데이터 품질과 재현성을 검증합니다.",
    },
    {
        "command": "lerobot-find-port",
        "module": "lerobot.scripts.lerobot_find_port",
        "category": "hardware",
        "title": "MotorsBus USB 포트 탐색",
        "description": "USB 케이블 분리 전·후 시리얼 디바이스 목록을 비교하여 리더/팔로워 컨트롤러 보드의 정확한 포트를 식별합니다.",
    },
    {
        "command": "lerobot-setup-motors",
        "module": "lerobot.scripts.lerobot_setup_motors",
        "category": "hardware",
        "title": "서보 모터 ID 및 보드레이트 초기화",
        "description": "Feetech / Dynamixel 모터를 끝단(Gripper)부터 베이스(Shoulder Pan) 순서로 1개씩 연결하며 고유 ID와 초기 위치를 플래싱합니다.",
    },
    {
        "command": "lerobot-calibrate",
        "module": "lerobot.scripts.lerobot_calibrate",
        "category": "hardware",
        "title": "로봇 / 텔레오퍼레이터 캘리브레이션",
        "description": "호밍 오프셋(중립 자세) 및 각 관절의 물리적 최소·최대 가동 범위를 측정해 JSON 캘리브레이션 파일로 저장합니다.",
    },
    {
        "command": "lerobot-find-cameras",
        "module": "lerobot.scripts.lerobot_find_cameras",
        "category": "hardware",
        "title": "연결 카메라 스캔 및 테스트 촬영",
        "description": "OpenCV 웹캠 및 Intel RealSense RGB-D 카메라의 인덱스/시리얼 번호, 기본 해상도, FPS를 스캔하고 테스트 프레임을 캡처합니다.",
    },
    {
        "command": "lerobot-find-joint-limits",
        "module": "lerobot.scripts.lerobot_find_joint_limits",
        "category": "hardware",
        "title": "관절 및 엔드이펙터 작업반경 추출",
        "description": "캘리브레이션 이후 안전 작업 공간(Workspace Bounding Box)과 관절 한계를 추출하여 HIL-SERL 강화학습 안전성을 높입니다.",
    },
    {
        "command": "lerobot-dataset-viz",
        "module": "lerobot.scripts.lerobot_dataset_viz",
        "category": "dataset",
        "title": "데이터셋 에피소드 시각화 (Rerun / Web)",
        "description": "로컬 또는 Hugging Face Hub의 LeRobotDataset v3.0 에피소드 프레임·관절 상태·액션을 타임라인으로 동기화 시각화합니다.",
    },
    {
        "command": "lerobot-imgtransform-viz",
        "module": "lerobot.scripts.lerobot_imgtransform_viz",
        "category": "dataset",
        "title": "이미지 증강(Transform) 미리보기",
        "description": "학습 시 적용될 밝기·대비·채도·색조·선명도 데이터 증강 파이프라인 결과를 샘플 프레임으로 미리 검증합니다.",
    },
    {
        "command": "lerobot-edit-dataset",
        "module": "lerobot.scripts.lerobot_edit_dataset",
        "category": "dataset",
        "title": "데이터셋 편집 스위트 (v3.0)",
        "description": "불량 에피소드 삭제, 비율/인덱스 기반 분할(Split), 다중 데이터셋 병합(Merge), 피처 제거, 태스크 문구 수정, 비디오 변환을 수행합니다.",
    },
    {
        "command": "lerobot-train",
        "module": "lerobot.scripts.lerobot_train",
        "category": "training",
        "title": "모방학습 / VLA / 강화학습 정책 학습",
        "description": "ACT, Diffusion, SmolVLA, π0, π0-FAST, π0.5, GR00T N1.5, X-VLA, VQ-BeT, TDMPC, HIL-SERL 정책을 단일/멀티 GPU 및 PEFT(LoRA)로 학습합니다.",
    },
    {
        "command": "lerobot-eval",
        "module": "lerobot.scripts.lerobot_eval",
        "category": "evaluation",
        "title": "시뮬레이션 벤치마크 정량 평가",
        "description": "LIBERO, MetaWorld, PushT, ALOHA, xArm, IsaacLab Arena 환경에서 학습된 정책의 성공률과 보상을 병렬 평가합니다.",
    },
    {
        "command": "python -m lerobot.async_inference.policy_server",
        "module": "lerobot.async_inference.policy_server",
        "category": "async_inference",
        "title": "비동기 추론 GPU 정책 서버 (gRPC)",
        "description": "고성능 GPU 서버에서 대형 VLA 모델을 호스팅하고 RobotClient로부터 관측값을 받아 액션 청크를 반환합니다.",
    },
    {
        "command": "python -m lerobot.async_inference.robot_client",
        "module": "lerobot.async_inference.robot_client",
        "category": "async_inference",
        "title": "비동기 추론 로봇 클라이언트 (RTC)",
        "description": "로봇 제어 루프를 지연 없이 유지하면서 PolicyServer와 통신하고 중첩 액션 청크를 실시간 블렌딩(Real-Time Chunking)합니다.",
    },
    {
        "command": "lerobot-info",
        "module": "lerobot.scripts.lerobot_info",
        "category": "system",
        "title": "시스템 및 환경 진단",
        "description": "LeRobot 0.4.4, Python, PyTorch, CUDA, Hugging Face Hub, Datasets, FFmpeg 인코더 호환성 정보를 출력합니다.",
    },
]


# ---------------------------------------------------------------------------
# 2. Supported Hardware Catalog in LeRobot v0.4.4
# ---------------------------------------------------------------------------
ROBOTS_V044: list[dict[str, Any]] = [
    {
        "type": "so101_follower",
        "name": "SO-ARM101 Follower",
        "category": "Single Arm (6-DoF)",
        "motor_bus": "Feetech STS3215 (pip install 'lerobot[feetech]')",
        "dof": 6,
        "joints": ["shoulder_pan.pos", "shoulder_lift.pos", "elbow_flex.pos", "wrist_flex.pos", "wrist_roll.pos", "gripper.pos"],
        "default_port": "/dev/ttyACM0",
        "recommended_teleop": "so101_leader",
        "config_fields": ["port", "id", "disable_torque_on_disconnect", "max_relative_target", "use_degrees", "cameras"],
    },
    {
        "type": "so100_follower",
        "name": "SO-ARM100 Follower",
        "category": "Single Arm (6-DoF)",
        "motor_bus": "Feetech STS3215 (pip install 'lerobot[feetech]')",
        "dof": 6,
        "joints": ["shoulder_pan.pos", "shoulder_lift.pos", "elbow_flex.pos", "wrist_flex.pos", "wrist_roll.pos", "gripper.pos"],
        "default_port": "/dev/ttyACM0",
        "recommended_teleop": "so100_leader",
        "config_fields": ["port", "id", "disable_torque_on_disconnect", "max_relative_target", "use_degrees", "cameras"],
    },
    {
        "type": "bi_so100_follower",
        "name": "Bi-SO100 Bimanual Follower",
        "category": "Bimanual Arm (12-DoF)",
        "motor_bus": "Dual Feetech STS3215",
        "dof": 12,
        "joints": [
            "left_shoulder_pan.pos", "left_shoulder_lift.pos", "left_elbow_flex.pos", "left_wrist_flex.pos", "left_wrist_roll.pos", "left_gripper.pos",
            "right_shoulder_pan.pos", "right_shoulder_lift.pos", "right_elbow_flex.pos", "right_wrist_flex.pos", "right_wrist_roll.pos", "right_gripper.pos",
        ],
        "default_port": "/dev/ttyACM0,/dev/ttyACM1",
        "recommended_teleop": "bi_so100_leader",
        "config_fields": ["left_arm_port", "right_arm_port", "id", "cameras"],
    },
    {
        "type": "koch_follower",
        "name": "Koch v1.1 Follower",
        "category": "Single Arm (6-DoF)",
        "motor_bus": "Dynamixel XL430 / XL330 (pip install 'lerobot[dynamixel]')",
        "dof": 6,
        "joints": ["shoulder_pan.pos", "shoulder_lift.pos", "elbow_flex.pos", "wrist_flex.pos", "wrist_roll.pos", "gripper.pos"],
        "default_port": "/dev/ttyUSB0",
        "recommended_teleop": "koch_leader",
        "config_fields": ["port", "id", "disable_torque_on_disconnect", "gripper_open_degree", "cameras"],
    },
    {
        "type": "bi_koch_follower",
        "name": "Bi-Koch v1.1 Bimanual Follower",
        "category": "Bimanual Arm (12-DoF)",
        "motor_bus": "Dual Dynamixel Bus",
        "dof": 12,
        "joints": [
            "left_shoulder_pan.pos", "left_shoulder_lift.pos", "left_elbow_flex.pos", "left_wrist_flex.pos", "left_wrist_roll.pos", "left_gripper.pos",
            "right_shoulder_pan.pos", "right_shoulder_lift.pos", "right_elbow_flex.pos", "right_wrist_flex.pos", "right_wrist_roll.pos", "right_gripper.pos",
        ],
        "default_port": "/dev/ttyUSB0,/dev/ttyUSB1",
        "recommended_teleop": "bi_koch_leader",
        "config_fields": ["left_arm_port", "right_arm_port", "id", "cameras"],
    },
    {
        "type": "lekiwi",
        "name": "LeKiwi Mobile Manipulator",
        "category": "Mobile Base + 6-DoF Arm (9-DoF)",
        "motor_bus": "Feetech Omni-Wheel + Arm (pip install 'lerobot[lekiwi]')",
        "dof": 9,
        "joints": ["arm_shoulder_pan.pos", "arm_shoulder_lift.pos", "arm_elbow_flex.pos", "arm_wrist_flex.pos", "arm_wrist_roll.pos", "arm_gripper.pos", "x.vel", "y.vel", "theta.vel"],
        "default_port": "/dev/ttyACM0",
        "recommended_teleop": "so101_leader",
        "config_fields": ["port", "id", "remote_ip", "cameras"],
    },
    {
        "type": "hope_jr",
        "name": "HopeJr Dexterous Arm & Hand",
        "category": "Humanoid Arm + Hand (pip install 'lerobot[hopejr]')",
        "motor_bus": "Feetech Multi-Servo Bus",
        "dof": 12,
        "joints": ["shoulder_pitch.pos", "shoulder_yaw.pos", "shoulder_roll.pos", "elbow_flex.pos", "wrist_roll.pos", "wrist_pitch.pos", "thumb.pos", "index.pos", "middle.pos", "ring.pos", "pinky.pos", "palm.pos"],
        "default_port": "/dev/ttyACM0",
        "recommended_teleop": "homunculus_glove",
        "config_fields": ["port", "id", "side", "cameras"],
    },
    {
        "type": "reachy2",
        "name": "Pollen Reachy 2 Humanoid",
        "category": "Upper-Body Humanoid (pip install 'lerobot[reachy2]')",
        "motor_bus": "gRPC Reachy2 SDK",
        "dof": 15,
        "joints": ["l_arm_pitch", "l_arm_roll", "l_arm_yaw", "l_elbow_pitch", "l_wrist_roll", "l_wrist_pitch", "l_gripper", "r_arm_pitch", "r_arm_roll", "r_arm_yaw", "r_elbow_pitch", "r_wrist_roll", "r_wrist_pitch", "r_gripper", "neck_yaw"],
        "default_port": "192.168.1.42",
        "recommended_teleop": "reachy2_teleoperator",
        "config_fields": ["ip_address", "id", "with_mobile_base", "cameras"],
    },
    {
        "type": "unitree_g1",
        "name": "Unitree G1 Humanoid (23/29 DoF)",
        "category": "Full Humanoid (pip install 'lerobot[unitree_g1]')",
        "motor_bus": "Unitree SDK2 + ZMQ Bridge / MuJoCo Sim",
        "dof": 29,
        "joints": ["left_hip_pitch", "left_knee", "left_ankle", "right_hip_pitch", "right_knee", "right_ankle", "waist_yaw", "left_shoulder_pitch", "left_elbow", "right_shoulder_pitch", "right_elbow"],
        "default_port": "192.168.123.164",
        "recommended_teleop": "gamepad",
        "config_fields": ["robot_ip", "is_simulation", "id", "cameras"],
    },
    {
        "type": "earthrover_mini",
        "name": "Earth Rover Mini",
        "category": "Outdoor Mobile Robot",
        "motor_bus": "Frodobots SDK",
        "dof": 2,
        "joints": ["linear_vel", "angular_vel"],
        "default_port": "local_sdk",
        "recommended_teleop": "gamepad",
        "config_fields": ["id", "cameras"],
    },
    {
        "type": "so100_follower_end_effector",
        "name": "SO-100 End-Effector (IK Mode)",
        "category": "Cartesian EE Control (HIL-SERL / Kinematics)",
        "motor_bus": "Feetech + Placo Kinematics (pip install 'lerobot[kinematics]')",
        "dof": 4,
        "joints": ["ee.x", "ee.y", "ee.z", "gripper.pos"],
        "default_port": "/dev/ttyACM0",
        "recommended_teleop": "gamepad",
        "config_fields": ["port", "id", "urdf_path", "end_effector_bounds", "cameras"],
    },
]

TELEOPERATORS_V044: list[dict[str, Any]] = [
    {"type": "so101_leader", "name": "SO-ARM101 Leader Arm", "connection": "USB Serial (/dev/ttyACM1)", "fields": ["port", "id", "use_degrees"]},
    {"type": "so100_leader", "name": "SO-ARM100 Leader Arm", "connection": "USB Serial (/dev/ttyACM1)", "fields": ["port", "id", "use_degrees"]},
    {"type": "bi_so100_leader", "name": "Bi-SO100 Dual Leader Arms", "connection": "Dual USB Serial", "fields": ["left_arm_port", "right_arm_port", "id"]},
    {"type": "koch_leader", "name": "Koch v1.1 Leader Arm", "connection": "Dynamixel USB (/dev/ttyUSB1)", "fields": ["port", "id", "gripper_open_degree"]},
    {"type": "bi_koch_leader", "name": "Bi-Koch v1.1 Dual Leader Arms", "connection": "Dual Dynamixel USB", "fields": ["left_arm_port", "right_arm_port", "id"]},
    {"type": "gamepad", "name": "Gamepad Controller (Xbox / PS / HID)", "connection": "Bluetooth / USB (lerobot[gamepad])", "fields": ["id", "use_gripper"]},
    {"type": "keyboard", "name": "Keyboard Teleop / EE Teleop", "connection": "Host Keyboard (pynput)", "fields": ["id"]},
    {"type": "phone", "name": "Smartphone 6-DoF Pose Teleop (iOS/Android)", "connection": "WebSocket / ARKit / ARCore (lerobot[phone])", "fields": ["id", "phone_os"]},
    {"type": "homunculus_glove", "name": "Homunculus Dexterous Exoskeleton / Glove", "connection": "USB Serial (HopeJr)", "fields": ["port", "id", "side"]},
    {"type": "reachy2_teleoperator", "name": "Reachy 2 VR / Leader Teleoperator", "connection": "gRPC IP", "fields": ["ip_address", "id"]},
]

CAMERAS_V044: list[dict[str, Any]] = [
    {
        "type": "opencv",
        "name": "OpenCV Camera (USB Webcam / Continuity Camera / V4L2)",
        "fields": ["index_or_path", "width", "height", "fps", "fourcc", "color_mode", "rotation", "warmup_s"],
        "example": "{type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30}",
    },
    {
        "type": "intelrealsense",
        "name": "Intel RealSense RGB-D Camera (D405 / D435i / D455)",
        "fields": ["serial_number_or_name", "width", "height", "fps", "use_depth", "color_mode", "rotation"],
        "example": "{type: intelrealsense, serial_number_or_name: '0123456789', width: 640, height: 480, fps: 30, use_depth: true}",
    },
]

# ---------------------------------------------------------------------------
# 3. Policies, Sim Environments & Dataset Edit Operations in v0.4.4
# ---------------------------------------------------------------------------
POLICIES_V044: list[dict[str, Any]] = [
    {"type": "act", "name": "ACT (Action Chunking with Transformers)", "family": "Imitation Learning", "vram": "6~8 GB", "extra": "base", "highlight": "가장 빠르고 안정적인 단일 태스크 양팔/단팔 모방학습 기본 권장 모델"},
    {"type": "diffusion", "name": "Diffusion Policy", "family": "Imitation Learning", "vram": "8~12 GB", "extra": "base", "highlight": "다중 모달(Multi-modal) 궤적 분포 학습에 강점"},
    {"type": "smolvla", "name": "SmolVLA (~450M)", "family": "Vision-Language-Action (VLA)", "vram": "12~16 GB", "extra": "lerobot[smolvla]", "highlight": "경량 오픈소스 VLA 모델 — 자연어 프롬프트 조건부 제어 및 빠른 추론"},
    {"type": "pi0", "name": "π₀ (Pi0 Flow-Matching VLA)", "family": "Vision-Language-Action (VLA)", "vram": "24+ GB", "extra": "lerobot[pi]", "highlight": "Physical Intelligence 범용 Flow-Matching VLA 파운데이션 정책"},
    {"type": "pi0fast", "name": "π₀-FAST (Autoregressive Action Tokenizer)", "family": "Vision-Language-Action (VLA)", "vram": "24+ GB", "extra": "lerobot[pi]", "highlight": "FAST 이산 액션 토크나이저 기반 고주파 정밀 조작 VLA"},
    {"type": "pi05", "name": "π₀.₅ (Open-World Generalization VLA)", "family": "Vision-Language-Action (VLA)", "vram": "24+ GB", "extra": "lerobot[pi]", "highlight": "계층적 태스크 추론 및 환경 일반화 성능이 강화된 π0.5"},
    {"type": "groot", "name": "NVIDIA GR00T N1.5", "family": "Vision-Language-Action (VLA)", "vram": "24+ GB", "extra": "lerobot[groot]", "highlight": "휴머노이드 및 양팔 로봇용 듀얼 시스템(System 1/2) VLA (v0.4.4 내장)"},
    {"type": "xvla", "name": "X-VLA", "family": "Vision-Language-Action (VLA)", "vram": "16~24 GB", "extra": "lerobot[transformers-dep]", "highlight": "크로스 임바디먼트(Cross-embodiment) 로봇 전이 학습 VLA"},
    {"type": "wall_oss", "name": "WALL-OSS", "family": "Vision-Language-Action (VLA)", "vram": "24+ GB", "extra": "lerobot[transformers-dep]", "highlight": "대규모 오픈소스 멀티모달 조작 정책"},
    {"type": "vqbet", "name": "VQ-BeT (Vector-Quantized Behavior Transformer)", "family": "Imitation Learning", "vram": "8~10 GB", "extra": "base", "highlight": "벡터 양자화 잠재 액션 코드북 기반 행동 트랜스포머"},
    {"type": "tdmpc", "name": "TD-MPC", "family": "Model-Based RL", "vram": "8 GB", "extra": "base", "highlight": "잠재 세계 모델 기반 모델 예측 제어 강화학습"},
    {"type": "sac", "name": "HIL-SERL / SAC (Human-in-the-Loop RL)", "family": "Real-World RL", "vram": "8~12 GB", "extra": "lerobot[hilserl]", "highlight": "실제 로봇에서 사람의 실시간 개입 데모와 온라인 강화학습을 결합"},
    {"type": "reward_classifier", "name": "Reward Classifier (SARM / HIL Reward)", "family": "Reward Model", "vram": "6 GB", "extra": "lerobot[hilserl]", "highlight": "카메라 이미지로부터 작업 성공 여부(0/1 보상)를 자동 판별하는 분류기"},
]

SIM_ENVS_V044: list[dict[str, Any]] = [
    {"type": "libero", "name": "LIBERO Benchmark", "tasks": ["libero_spatial", "libero_object", "libero_goal", "libero_10", "libero_90"], "extra": "lerobot[libero]"},
    {"type": "metaworld", "name": "Meta-World (MT10 / MT50)", "tasks": ["metaworld-push-v2", "metaworld-pick-place-v2", "MT10", "MT50"], "extra": "lerobot[metaworld]"},
    {"type": "aloha", "name": "Gym-ALOHA Bimanual Sim", "tasks": ["AlohaInsertion-v0", "AlohaTransferCube-v0"], "extra": "lerobot[aloha]"},
    {"type": "pusht", "name": "Gym-PushT 2D Manipulation", "tasks": ["PushT-v0"], "extra": "lerobot[pusht]"},
    {"type": "xarm", "name": "Gym-xArm Manipulation", "tasks": ["XarmLift-v0"], "extra": "lerobot[xarm]"},
    {"type": "isaaclab_arena", "name": "NVIDIA IsaacLab-Arena / LeIsaac (EnvHub)", "tasks": ["PickOrange-v0", "LiftCube-v0", "CleanTable-v0"], "extra": "EnvHub URI"},
]

DATASET_EDIT_OPERATIONS_V044: list[dict[str, Any]] = [
    {
        "type": "delete_episodes",
        "title": "불량 에피소드 선택 삭제",
        "description": "실패하거나 흔들린 에피소드 인덱스를 제거하고 Parquet/MP4 오프셋과 통계를 재정렬합니다.",
        "args": {"episode_indices": "[0, 2, 5]"},
    },
    {
        "type": "split",
        "title": "데이터셋 분할 (비율 또는 인덱스)",
        "description": "train / val / test 비율(예: 0.8 / 0.2) 또는 특정 에피소드 리스트별로 서브 데이터셋을 생성합니다.",
        "args": {"splits": '{"train": 0.8, "val": 0.2}'},
    },
    {
        "type": "merge",
        "title": "다중 데이터셋 병합 (Merge)",
        "description": "동일 로봇·카메라·FPS 구성을 가진 여러 세션 데이터셋을 하나의 통합 LeRobotDataset v3.0으로 병합합니다.",
        "args": {"repo_ids": "['user/session_1', 'user/session_2']"},
    },
    {
        "type": "remove_feature",
        "title": "특정 관측 피처/카메라 제거",
        "description": "사용하지 않는 카메라 뷰(예: observation.images.wrist) 또는 불필요한 센서 컬럼을 제거합니다.",
        "args": {"feature_names": "['observation.images.wrist']"},
    },
    {
        "type": "modify_tasks",
        "title": "자연어 작업 설명(Task) 일괄/개별 수정",
        "description": "오타가 있거나 세분화가 필요한 에피소드별 언어 지시문(single_task / tasks)을 재라벨링합니다.",
        "args": {"new_task": "Pick up the red block and place it into the tray"},
    },
    {
        "type": "convert_image_to_video",
        "title": "PNG 이미지 데이터셋 → MP4 비디오 변환",
        "description": "--dataset.video=false로 수집된 원시 이미지 데이터셋을 고효율 MP4 스트림 포맷으로 압축 변환합니다.",
        "args": {"vcodec": "libsvtav1"},
    },
]


# ---------------------------------------------------------------------------
# 4. Command & Python Code Builders for LeRobot v0.4.4
# ---------------------------------------------------------------------------
def format_cameras_draccus(cameras: list[dict[str, Any]]) -> str:
    """Format camera list into LeRobot v0.4.4 draccus inline YAML dict syntax."""
    if not cameras:
        return "{}"
    entries: list[str] = []
    for cam in cameras:
        name = cam.get("name", "front").strip() or "front"
        cam_type = cam.get("type", "opencv")
        width = int(cam.get("width", 640))
        height = int(cam.get("height", 480))
        fps = int(cam.get("fps", 30))
        if cam_type == "intelrealsense":
            serial = cam.get("index_or_path", "0123456789")
            use_depth = str(bool(cam.get("use_depth", False))).lower()
            entries.append(
                f"{name}: {{type: intelrealsense, serial_number_or_name: '{serial}', width: {width}, height: {height}, fps: {fps}, use_depth: {use_depth}}}"
            )
        else:
            idx_raw = str(cam.get("index_or_path", "0")).strip()
            idx_str = idx_raw if idx_raw.isdigit() else f"'{idx_raw}'"
            entries.append(
                f"{name}: {{type: opencv, index_or_path: {idx_str}, width: {width}, height: {height}, fps: {fps}}}"
            )
    return "{ " + ", ".join(entries) + " }"


def build_record_commands(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Validate a RecordConfig payload against LeRobot v0.4.4 rules and generate:
    1. Exact `lerobot-record` CLI command
    2. Exact Python API script (`lerobot==0.4.4`)
    3. Validation warnings / errors
    """
    errors: list[str] = []
    warnings: list[str] = []

    mode = payload.get("control_mode", "teleop")  # teleop | policy | hil_both
    robot = payload.get("robot", {})
    teleop = payload.get("teleop", {})
    policy = payload.get("policy", {})
    dataset = payload.get("dataset", {})
    options = payload.get("options", {})

    single_task = str(dataset.get("single_task", "")).strip()
    repo_id = str(dataset.get("repo_id", "")).strip()

    if not single_task:
        errors.append("DatasetRecordConfig.__post_init__: `dataset.single_task` (작업 자연어 설명)은 필수 입력값입니다.")
    if not repo_id or "/" not in repo_id:
        errors.append("DatasetRecordConfig: `dataset.repo_id`는 `{hf_user}/{dataset_name}` 형식이어야 합니다.")
    if mode not in ("teleop", "policy", "hil_both"):
        errors.append("RecordConfig.__post_init__: `teleop` 또는 `policy` 중 최소 하나를 선택해야 합니다.")
    if mode in ("policy", "hil_both") and not str(policy.get("path", "")).strip():
        errors.append("정책 기반 기록 모드에서는 `--policy.path` (체크포인트 경로 또는 Hub ID)가 필요합니다.")

    cameras = robot.get("cameras", [])
    for c in cameras:
        if not c.get("width") or not c.get("height") or not c.get("fps"):
            errors.append(f"RobotConfig.__post_init__: 카메라 '{c.get('name', '?')}'에 width, height, fps가 모두 지정되어야 합니다.")

    fps = int(dataset.get("fps", 30))
    for c in cameras:
        if int(c.get("fps", fps)) != fps:
            warnings.append(
                f"카메라 '{c.get('name')}' FPS({c.get('fps')})가 데이터셋 제어 루프 FPS({fps})와 다릅니다. 동기화를 위해 일치시키는 것을 권장합니다."
            )

    if mode == "policy" and repo_id and not repo_id.split("/")[-1].startswith("eval_"):
        warnings.append("실기기 정책 평가 기록 시 관례적으로 데이터셋 이름을 `eval_` 접두사(예: `user/eval_so101`)로 지정하는 것을 권장합니다.")

    # Build CLI args
    r_type = robot.get("type", "so101_follower")
    cli_lines = ["lerobot-record \\", f"  --robot.type={r_type} \\"]

    if r_type.startswith("bi_"):
        left_p = robot.get("left_arm_port", "/dev/ttyACM0")
        right_p = robot.get("right_arm_port", "/dev/ttyACM1")
        cli_lines.append(f"  --robot.left_arm_port={left_p} \\")
        cli_lines.append(f"  --robot.right_arm_port={right_p} \\")
    elif r_type in ("reachy2", "unitree_g1"):
        ip_field = "ip_address" if r_type == "reachy2" else "robot_ip"
        cli_lines.append(f"  --robot.{ip_field}={robot.get('port', '192.168.1.42')} \\")
    else:
        cli_lines.append(f"  --robot.port={robot.get('port', '/dev/ttyACM0')} \\")

    if robot.get("id"):
        cli_lines.append(f"  --robot.id={robot['id']} \\")
    if robot.get("disable_torque_on_disconnect") is not None:
        cli_lines.append(f"  --robot.disable_torque_on_disconnect={str(bool(robot['disable_torque_on_disconnect'])).lower()} \\")
    if robot.get("max_relative_target"):
        cli_lines.append(f"  --robot.max_relative_target={robot['max_relative_target']} \\")
    if cameras:
        cam_str = format_cameras_draccus(cameras)
        cli_lines.append(f"  --robot.cameras=\"{cam_str}\" \\")

    # Teleop section
    if mode in ("teleop", "hil_both"):
        t_type = teleop.get("type", "so101_leader")
        cli_lines.append(f"  --teleop.type={t_type} \\")
        if t_type.startswith("bi_"):
            cli_lines.append(f"  --teleop.left_arm_port={teleop.get('left_arm_port', '/dev/ttyACM2')} \\")
            cli_lines.append(f"  --teleop.right_arm_port={teleop.get('right_arm_port', '/dev/ttyACM3')} \\")
        elif t_type in ("so101_leader", "so100_leader", "koch_leader", "homunculus_glove"):
            cli_lines.append(f"  --teleop.port={teleop.get('port', '/dev/ttyACM1')} \\")
        if teleop.get("id"):
            cli_lines.append(f"  --teleop.id={teleop['id']} \\")

    # Policy section
    if mode in ("policy", "hil_both") and policy.get("path"):
        cli_lines.append(f"  --policy.path={shlex.quote(str(policy['path']))} \\")
        if policy.get("device"):
            cli_lines.append(f"  --policy.device={policy['device']} \\")

    # Dataset section
    cli_lines.append(f"  --dataset.repo_id={repo_id or 'hf_user/so101_pick_place'} \\")
    cli_lines.append(f"  --dataset.single_task={shlex.quote(single_task or 'Grab the object')} \\")
    cli_lines.append(f"  --dataset.fps={fps} \\")
    cli_lines.append(f"  --dataset.num_episodes={int(dataset.get('num_episodes', 50))} \\")
    cli_lines.append(f"  --dataset.episode_time_s={dataset.get('episode_time_s', 60)} \\")
    cli_lines.append(f"  --dataset.reset_time_s={dataset.get('reset_time_s', 15)} \\")
    cli_lines.append(f"  --dataset.video={str(bool(dataset.get('video', True))).lower()} \\")
    cli_lines.append(f"  --dataset.push_to_hub={str(bool(dataset.get('push_to_hub', True))).lower()} \\")

    if dataset.get("private"):
        cli_lines.append("  --dataset.private=true \\")
    if dataset.get("root"):
        cli_lines.append(f"  --dataset.root={shlex.quote(str(dataset['root']))} \\")
    if dataset.get("num_image_writer_processes", 0) != 0:
        cli_lines.append(f"  --dataset.num_image_writer_processes={int(dataset['num_image_writer_processes'])} \\")
    if dataset.get("num_image_writer_threads_per_camera", 4) != 4:
        cli_lines.append(f"  --dataset.num_image_writer_threads_per_camera={int(dataset['num_image_writer_threads_per_camera'])} \\")
    if dataset.get("vcodec") and dataset.get("vcodec") != "libsvtav1":
        cli_lines.append(f"  --dataset.vcodec={dataset['vcodec']} \\")

    cli_lines.append(f"  --display_data={str(bool(options.get('display_data', True))).lower()} \\")
    cli_lines.append(f"  --play_sounds={str(bool(options.get('play_sounds', True))).lower()} \\")
    cli_lines.append(f"  --resume={str(bool(options.get('resume', False))).lower()}")

    cli_command = "\n".join(cli_lines)

    # Build Python API Script for LeRobot v0.4.4
    cam_py_lines = []
    for c in cameras:
        c_name = c.get("name", "front")
        if c.get("type") == "intelrealsense":
            cam_py_lines.append(
                f'        "{c_name}": RealSenseCameraConfig(serial_number_or_name="{c.get("index_or_path", "0123456789")}", width={int(c.get("width", 640))}, height={int(c.get("height", 480))}, fps={int(c.get("fps", 30))}, use_depth={bool(c.get("use_depth", False))}),'
            )
        else:
            idx_val = c.get("index_or_path", 0)
            idx_repr = int(idx_val) if str(idx_val).isdigit() else f'"{idx_val}"'
            cam_py_lines.append(
                f'        "{c_name}": OpenCVCameraConfig(index_or_path={idx_repr}, width={int(c.get("width", 640))}, height={int(c.get("height", 480))}, fps={int(c.get("fps", 30))}),'
            )
    cams_block = "{\n" + "\n".join(cam_py_lines) + "\n    }" if cam_py_lines else "{}"

    python_code = f'''# LeRobot v0.4.4 Python API — Data Collection & Recording
from lerobot.cameras.opencv.configuration_opencv import OpenCVCameraConfig
from lerobot.cameras.realsense.configuration_realsense import RealSenseCameraConfig
from lerobot.configs.policies import PreTrainedConfig
from lerobot.robots import make_robot_from_config
from lerobot.scripts.lerobot_record import DatasetRecordConfig, RecordConfig, record

# 1. 카메라 및 팔로워 로봇 설정 ({r_type})
from lerobot.robots.{r_type} import { _to_class_prefix(r_type) }Config

robot_cfg = { _to_class_prefix(r_type) }Config(
    port="{robot.get('port', '/dev/ttyACM0')}",
    id="{robot.get('id', 'my_follower_arm')}",
    disable_torque_on_disconnect={bool(robot.get('disable_torque_on_disconnect', True))},
    cameras={cams_block},
)
'''

    if mode in ("teleop", "hil_both"):
        t_type = teleop.get("type", "so101_leader")
        python_code += f'''
# 2. 텔레오퍼레이터 설정 ({t_type})
from lerobot.teleoperators.{t_type} import { _to_class_prefix(t_type) }Config

teleop_cfg = { _to_class_prefix(t_type) }Config(
    port="{teleop.get('port', '/dev/ttyACM1')}",
    id="{teleop.get('id', 'my_leader_arm')}",
)
'''
    else:
        python_code += "\nteleop_cfg = None\n"

    if mode in ("policy", "hil_both") and policy.get("path"):
        python_code += f'''
# 2-B. 사전학습 정책 로드
policy_cfg = PreTrainedConfig.from_pretrained("{policy.get('path')}")
policy_cfg.pretrained_path = "{policy.get('path')}"
'''
    else:
        python_code += "policy_cfg = None\n"

    python_code += f'''
# 3. LeRobotDataset v3.0 수집 설정
dataset_cfg = DatasetRecordConfig(
    repo_id="{repo_id or 'hf_user/so101_pick_place'}",
    single_task="{single_task or 'Grab the object'}",
    fps={fps},
    episode_time_s={dataset.get('episode_time_s', 60)},
    reset_time_s={dataset.get('reset_time_s', 15)},
    num_episodes={int(dataset.get('num_episodes', 50))},
    video={bool(dataset.get('video', True))},
    push_to_hub={bool(dataset.get('push_to_hub', True))},
    private={bool(dataset.get('private', False))},
    num_image_writer_processes={int(dataset.get('num_image_writer_processes', 0))},
    num_image_writer_threads_per_camera={int(dataset.get('num_image_writer_threads_per_camera', 4))},
)

# 4. RecordConfig 결합 및 세션 실행 (단축키: → 조기완료, ← 재녹화, ESC 종료/업로드)
cfg = RecordConfig(
    robot=robot_cfg,
    dataset=dataset_cfg,
    teleop=teleop_cfg,
    policy=policy_cfg,
    display_data={bool(options.get('display_data', True))},
    play_sounds={bool(options.get('play_sounds', True))},
    resume={bool(options.get('resume', False))},
)

dataset = record(cfg)
print(f"Saved {{dataset.num_episodes}} episodes ({{dataset.num_frames}} frames) to {{dataset.root}}")
'''

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "cli_command": cli_command,
        "python_code": python_code,
    }


def _to_class_prefix(type_name: str) -> str:
    mapping = {
        "so101_follower": "SO101Follower",
        "so100_follower": "SO100Follower",
        "bi_so100_follower": "BiSO100Follower",
        "koch_follower": "KochFollower",
        "bi_koch_follower": "BiKochFollower",
        "lekiwi": "LeKiwi",
        "hope_jr": "HopeJr",
        "reachy2": "Reachy2Robot",
        "unitree_g1": "UnitreeG1",
        "earthrover_mini": "EarthRoverMini",
        "so100_follower_end_effector": "SO100FollowerEndEffector",
        "so101_leader": "SO101Leader",
        "so100_leader": "SO100Leader",
        "bi_so100_leader": "BiSO100Leader",
        "koch_leader": "KochLeader",
        "bi_koch_leader": "BiKochLeader",
        "gamepad": "GamepadTeleop",
        "keyboard": "KeyboardTeleop",
        "phone": "PhoneTeleop",
        "homunculus_glove": "HomunculusGlove",
        "reachy2_teleoperator": "Reachy2Teleoperator",
    }
    return mapping.get(type_name, "".join(part.capitalize() for part in type_name.split("_")))
