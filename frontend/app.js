/* ==========================================================================
   LeRobot v0.4.4 Web Studio — Frontend Controller & Python Bridge Client
   ========================================================================== */

(() => {
  const state = {
    catalog: null,
    controlMode: "teleop", // teleop | policy | hil_both
    codeTab: "cli", // cli | py
    latestGenerated: { cli_command: "", python_code: "" },
    cameras: [
      { name: "front", type: "opencv", index_or_path: "0", width: 640, height: 480, fps: 30 },
      { name: "wrist", type: "opencv", index_or_path: "1", width: 640, height: 480, fps: 30 },
    ],
    ws: null,
    wsConnected: false,
    telemetryHistory: [], // ring buffer of primary joint obs vs action
    lastFrameData: null,
  };

  // DOM Lookup Helper
  const $ = (id) => document.getElementById(id);

  // -------------------------------------------------------------------------
  // 1. Navigation Switching
  // -------------------------------------------------------------------------
  function setupNavigation() {
    const buttons = document.querySelectorAll("#main-nav .nav-btn");
    const panels = document.querySelectorAll(".view-panel");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = $(btn.dataset.view);
        if (target) target.classList.add("active");
      });
    });
  }

  // -------------------------------------------------------------------------
  // 2. Fetch LeRobot v0.4.4 Catalog from Python FastAPI Bridge
  // -------------------------------------------------------------------------
  async function loadCatalog() {
    const resp = await fetch("/api/v044/catalog");
    const data = await resp.json();
    state.catalog = data;

    // Runtime Header Info
    const rt = data.runtime;
    $("runtime-mode-label").textContent = rt.lerobot_installed
      ? `lerobot ${rt.detected_lerobot_version} (LIVE)`
      : "v0.4.4 Sim Bridge";
    $("diag-python-ver").textContent = `Python ${rt.python_version}`;

    $("lerobot-info-box").textContent = [
      `- Target LeRobot schema : v${rt.target_lerobot_version} (Dataset ${rt.dataset_format_version})`,
      `- Host lerobot package  : ${rt.lerobot_installed ? rt.detected_lerobot_version : "Not installed (Python Bridge Simulation Active)"}`,
      `- Platform              : ${rt.platform}`,
      `- Python version        : ${rt.python_version}`,
      `- PyTorch available     : ${rt.pytorch_installed}`,
      `- Install for hardware  : pip install "lerobot[feetech,async]==0.4.4"`,
    ].join("\n");

    // Populate CLI Catalog Table
    const cliBody = $("cli-catalog-tbody");
    cliBody.innerHTML = data.cli_commands
      .map(
        (c) => `
      <tr>
        <td style="font-family:var(--font-mono); color:var(--accent-amber); white-space:nowrap;">${c.command}</td>
        <td style="color:var(--text-secondary);">${c.description}</td>
      </tr>`
      )
      .join("");

    // Populate Robot & Teleop Selects
    const robotSel = $("rec-robot-type");
    robotSel.innerHTML = data.robots
      .map((r) => `<option value="${r.type}">${r.type} — ${r.name} (${r.dof} DoF)</option>`)
      .join("");

    const teleopSel = $("rec-teleop-type");
    teleopSel.innerHTML = data.teleoperators
      .map((t) => `<option value="${t.type}">${t.type} — ${t.name}</option>`)
      .join("");

    // Populate Policy Select
    const polSel = $("tr-policy-type");
    polSel.innerHTML = data.policies
      .map((p) => `<option value="${p.type}">${p.type} — ${p.name}</option>`)
      .join("");

    // Populate Sim Env Select
    const envSel = $("ev-env-type");
    envSel.innerHTML = data.sim_envs
      .map((e) => `<option value="${e.type}">${e.type} — ${e.name}</option>`)
      .join("");

    renderCameraBuilder();
    renderEpisodesTable(data.session.episodes || []);
    rebuildTeleopSliders();
    await refreshRecordValidation();
    await refreshAllSecondaryBuilders();
    await scanPortsOrCameras("ports");
  }

  // -------------------------------------------------------------------------
  // 3. Camera Dictionary Builder (`--robot.cameras`)
  // -------------------------------------------------------------------------
  function renderCameraBuilder() {
    const container = $("rec-camera-list");
    container.innerHTML = "";

    state.cameras.forEach((cam, idx) => {
      const row = document.createElement("div");
      row.className = "cam-item-row";
      row.innerHTML = `
        <input type="text" class="mono" value="${cam.name}" aria-label="Camera key" placeholder="front" data-idx="${idx}" data-field="name" />
        <select class="mono" data-idx="${idx}" data-field="type">
          <option value="opencv" ${cam.type === "opencv" ? "selected" : ""}>opencv</option>
          <option value="intelrealsense" ${cam.type === "intelrealsense" ? "selected" : ""}>intelrealsense</option>
        </select>
        <input type="text" class="mono" value="${cam.index_or_path}" placeholder="id/serial" data-idx="${idx}" data-field="index_or_path" />
        <input type="text" class="mono" value="${cam.width}x${cam.height}" placeholder="640x480" data-idx="${idx}" data-field="res" />
        <input type="number" class="mono" value="${cam.fps}" min="5" max="120" data-idx="${idx}" data-field="fps" />
        <button type="button" class="btn btn-danger" data-remove="${idx}" style="padding:4px 8px; font-size:11px;">✕</button>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("change", (e) => {
        const i = Number(e.target.dataset.idx);
        const f = e.target.dataset.field;
        if (f === "res") {
          const parts = e.target.value.toLowerCase().split("x");
          state.cameras[i].width = Number(parts[0]) || 640;
          state.cameras[i].height = Number(parts[1]) || 480;
        } else if (f === "fps") {
          state.cameras[i].fps = Number(e.target.value) || 30;
        } else {
          state.cameras[i][f] = e.target.value;
        }
        updateCameraOverlayLabels();
        refreshRecordValidation();
        refreshAllSecondaryBuilders();
      });
    });

    container.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.remove);
        state.cameras.splice(i, 1);
        renderCameraBuilder();
        updateCameraOverlayLabels();
        refreshRecordValidation();
      });
    });

    updateCameraOverlayLabels();
  }

  function updateCameraOverlayLabels() {
    const c0 = state.cameras[0];
    const c1 = state.cameras[1];
    $("cam-label-0").textContent = c0
      ? `observation.images.${c0.name} · ${c0.width}×${c0.height} @ ${c0.fps}fps`
      : "Camera #0 Disabled";
    $("cam-label-1").textContent = c1
      ? `observation.images.${c1.name} · ${c1.width}×${c1.height} @ ${c1.fps}fps`
      : "Single Camera Mode";
    $("cam-codec-0").textContent = $("rec-video").checked
      ? `MP4 (${$("rec-vcodec").value})`
      : "PNG Frames";
  }

  // -------------------------------------------------------------------------
  // 4. Build & Validate RecordConfig Payload via Python Backend
  // -------------------------------------------------------------------------
  function collectRecordPayload() {
    const maxRelVal = $("rec-max-rel").value.trim();
    return {
      control_mode: state.controlMode,
      robot: {
        type: $("rec-robot-type").value,
        port: $("rec-robot-port").value.trim(),
        id: $("rec-robot-id").value.trim(),
        disable_torque_on_disconnect: true,
        max_relative_target: maxRelVal ? Number(maxRelVal) : null,
        cameras: state.cameras,
      },
      teleop: {
        type: $("rec-teleop-type").value,
        port: $("rec-teleop-port").value.trim(),
        id: $("rec-teleop-id").value.trim(),
      },
      policy: {
        path: $("rec-policy-path").value.trim(),
        device: "cuda",
      },
      dataset: {
        repo_id: $("rec-repo-id").value.trim(),
        single_task: $("rec-single-task").value,
        num_episodes: Number($("rec-num-episodes").value) || 10,
        fps: Number($("rec-fps").value) || 30,
        episode_time_s: Number($("rec-ep-time").value) || 30,
        reset_time_s: Number($("rec-reset-time").value) || 0,
        vcodec: $("rec-vcodec").value,
        num_image_writer_processes: 0,
        num_image_writer_threads_per_camera: Number($("rec-writer-threads").value) || 4,
        video: $("rec-video").checked,
        push_to_hub: $("rec-push-hub").checked,
        private: $("rec-private").checked,
      },
      options: {
        display_data: $("rec-display").checked,
        play_sounds: $("rec-sounds").checked,
        resume: $("rec-resume").checked,
      },
    };
  }

  async function refreshRecordValidation() {
    const payload = collectRecordPayload();
    $("active-robot-badge").textContent = payload.robot.type;
    $("writer-threads-badge").textContent = `AsyncImageWriter: ${payload.dataset.num_image_writer_threads_per_camera} threads/cam`;
    const repoLbl = $("summary-repo-label");
    const taskLbl = $("summary-task-label");
    if (repoLbl) repoLbl.textContent = payload.dataset.repo_id;
    if (taskLbl) taskLbl.textContent = `"${payload.dataset.single_task}"`;
    updateCameraOverlayLabels();

    const resp = await fetch("/api/v044/record/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res = await resp.json();
    state.latestGenerated = res;

    const vbox = $("record-validation-box");
    const banners = [];
    (res.errors || []).forEach((err) => {
      banners.push(`<div class="validation-banner error">✕ ${err}</div>`);
    });
    (res.warnings || []).forEach((w) => {
      banners.push(`<div class="validation-banner warn">⚠ ${w}</div>`);
    });
    vbox.innerHTML = banners.join("");

    renderGeneratedRecordCode();
  }

  function renderGeneratedRecordCode() {
    $("record-generated-code").textContent =
      state.codeTab === "cli"
        ? state.latestGenerated.cli_command
        : state.latestGenerated.python_code;
  }

  // -------------------------------------------------------------------------
  // 5. Start / Control `lerobot-record` Session & Keyboard Shortcuts
  // -------------------------------------------------------------------------
  function toggleConfigDrawer(open) {
    const drawer = $("config-drawer");
    const backdrop = $("config-drawer-backdrop");
    if (!drawer || !backdrop) return;
    drawer.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
  }

  async function startRecordingSession() {
    const payload = collectRecordPayload();
    const resp = await fetch("/api/v044/record/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res = await resp.json();
    if (!res.ok) {
      await refreshRecordValidation();
      toggleConfigDrawer(true);
      return;
    }
    applySessionSnapshot(res.status);
  }

  async function sendSessionControl(action, extra = {}) {
    if (state.ws && state.wsConnected) {
      state.ws.send(JSON.stringify({ action, ...extra }));
    } else {
      const resp = await fetch("/api/v044/record/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const snap = await resp.json();
      applySessionSnapshot(snap);
    }
  }

  function setupRecordControls() {
    // Slide-over Config Drawer Open/Close
    $("btn-open-config-drawer")?.addEventListener("click", () => toggleConfigDrawer(true));
    $("btn-open-config-inline")?.addEventListener("click", () => toggleConfigDrawer(true));
    $("btn-close-config-drawer")?.addEventListener("click", () => toggleConfigDrawer(false));
    $("config-drawer-backdrop")?.addEventListener("click", () => toggleConfigDrawer(false));

    // Segmented Mode Tabs
    document.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.controlMode = btn.dataset.mode;

        const showTeleop = state.controlMode === "teleop" || state.controlMode === "hil_both";
        const showPolicy = state.controlMode === "policy" || state.controlMode === "hil_both";

        document.querySelectorAll(".teleop-only-field").forEach((el) => {
          el.style.display = showTeleop ? "flex" : "none";
        });
        document.querySelectorAll(".policy-only-field").forEach((el) => {
          el.style.display = showPolicy ? "flex" : "none";
        });

        const modeLabels = {
          teleop: "Teleop Collection Mode",
          policy: "Policy Eval / Rollout Mode",
          hil_both: "HIL Intervention Mode (Both)",
        };
        $("active-mode-badge").textContent = modeLabels[state.controlMode];
        refreshRecordValidation();
      });
    });

    // Auto-select recommended teleoperator when robot changes
    $("rec-robot-type").addEventListener("change", () => {
      const rType = $("rec-robot-type").value;
      const found = (state.catalog?.robots || []).find((r) => r.type === rType);
      if (found) {
        $("rec-robot-port").value = found.default_port;
        $("rec-robot-id").value = `my_${found.type}`;
        if (found.recommended_teleop) {
          $("rec-teleop-type").value = found.recommended_teleop;
          $("rec-teleop-id").value = `my_${found.recommended_teleop}`;
        }
      }
      rebuildTeleopSliders();
      refreshRecordValidation();
      refreshAllSecondaryBuilders();
    });

    // Re-validate on any RecordConfig input change
    [
      "rec-robot-port", "rec-robot-id", "rec-max-rel",
      "rec-teleop-type", "rec-teleop-port", "rec-teleop-id",
      "rec-policy-path", "rec-repo-id", "rec-single-task",
      "rec-num-episodes", "rec-fps", "rec-ep-time", "rec-reset-time",
      "rec-vcodec", "rec-writer-threads",
      "rec-video", "rec-push-hub", "rec-private", "rec-display", "rec-sounds", "rec-resume",
    ].forEach((id) => {
      $(id).addEventListener("input", refreshRecordValidation);
      $(id).addEventListener("change", refreshRecordValidation);
    });

    $("btn-add-camera").addEventListener("click", () => {
      const nextIdx = state.cameras.length;
      state.cameras.push({
        name: nextIdx === 0 ? "front" : nextIdx === 1 ? "wrist" : `cam_${nextIdx}`,
        type: "opencv",
        index_or_path: String(nextIdx),
        width: 640,
        height: 480,
        fps: Number($("rec-fps").value) || 30,
      });
      renderCameraBuilder();
      refreshRecordValidation();
    });

    // Code Tabs & Copy
    $("tab-code-cli").addEventListener("click", () => {
      state.codeTab = "cli";
      $("tab-code-cli").classList.add("btn-cyan");
      $("tab-code-py").classList.remove("btn-cyan");
      renderGeneratedRecordCode();
    });
    $("tab-code-py").addEventListener("click", () => {
      state.codeTab = "py";
      $("tab-code-py").classList.add("btn-cyan");
      $("tab-code-cli").classList.remove("btn-cyan");
      renderGeneratedRecordCode();
    });
    $("btn-copy-record-code").addEventListener("click", async () => {
      await navigator.clipboard.writeText($("record-generated-code").textContent);
      $("btn-copy-record-code").textContent = "복사 완료!";
      setTimeout(() => ($("btn-copy-record-code").textContent = "복사"), 1300);
    });

    // Transport Buttons
    $("btn-start-record").addEventListener("click", startRecordingSession);
    $("btn-key-right").addEventListener("click", () => sendSessionControl("right_arrow"));
    $("btn-key-left").addEventListener("click", () => sendSessionControl("left_arrow"));
    $("btn-key-esc").addEventListener("click", () => sendSessionControl("escape"));

    // Global Keyboard Listeners (Right Arrow, Left Arrow, Escape) — active when not typing in an input
    window.addEventListener("keydown", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const drawerOpen = $("config-drawer")?.classList.contains("open");
      if (drawerOpen && e.key === "Escape") {
        e.preventDefault();
        toggleConfigDrawer(false);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        sendSessionControl("right_arrow");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        sendSessionControl("left_arrow");
      } else if (e.key === "Escape") {
        e.preventDefault();
        sendSessionControl("escape");
      }
    });
  }

  // -------------------------------------------------------------------------
  // 6. WebSocket 30Hz Stream & Canvas Renderers
  // -------------------------------------------------------------------------
  function connectWebSocket() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/ws/telemetry`;
    const ws = new WebSocket(wsUrl);
    state.ws = ws;

    ws.onopen = () => {
      state.wsConnected = true;
      $("ws-dot").className = "status-dot connected";
      $("ws-label").textContent = "Bridge Online";
    };

    ws.onmessage = (ev) => {
      const packet = JSON.parse(ev.data);
      state.lastFrameData = packet;
      applySessionSnapshot(packet.session);
      renderTelemetry(packet.telemetry, packet.session);
    };

    ws.onclose = () => {
      state.wsConnected = false;
      $("ws-dot").className = "status-dot";
      $("ws-label").textContent = "Reconnecting...";
      setTimeout(connectWebSocket, 1500);
    };
  }

  let lastEpisodeListHash = "";
  let lastLogHash = "";

  function applySessionSnapshot(snap) {
    if (!snap) return;
    const st = snap.state; // IDLE | RECORDING | RESETTING | COMPLETED
    const nextEp = typeof snap.reset_next_episode === "number" ? snap.reset_next_episode : snap.current_episode + 1;
    const isDiscardReset = st === "RESETTING" && nextEp === snap.current_episode;

    const pill = $("session-state-pill");
    if (pill) {
      pill.textContent = st;
      pill.className =
        st === "RECORDING"
          ? "badge red"
          : st === "RESETTING"
          ? "badge amber"
          : st === "COMPLETED"
          ? "badge green"
          : "badge";
    }

    // Global Topbar Live Recording Indicator
    const gPill = $("global-rec-pill");
    const gDot = $("global-rec-dot");
    const gText = $("global-rec-text");
    const gTime = $("global-rec-time");

    // Stage Status Strip
    const banner = $("live-status-banner");
    const bChip = $("banner-state-chip");
    const bHead = $("banner-headline");
    const bSub = $("banner-subdesc");

    // Camera Tally Rings & Badges
    const vp0 = $("cam-viewport-0");
    const vp1 = $("cam-viewport-1");
    const tally0 = $("cam-tally-0");
    const tally1 = $("cam-tally-1");
    const tallyTxt0 = $("cam-tally-text-0");
    const tallyTxt1 = $("cam-tally-text-1");
    const tc0 = $("cam-timecode-0");

    // Deck State & Dynamic Action Buttons
    const deckPill = $("deck-state-pill");
    const btnStartLbl = $("btn-start-label");
    const btnRight = $("btn-key-right");
    const btnRightLbl = $("btn-right-label");
    const btnLeft = $("btn-key-left");
    const btnLeftLbl = $("btn-left-label");
    const btnEsc = $("btn-key-esc");

    const mins = String(Math.floor(snap.phase_elapsed_s / 60)).padStart(2, "0");
    const secs = (snap.phase_elapsed_s % 60).toFixed(1).padStart(4, "0");
    const tcFormatted = `${mins}:${secs}`;
    if (tc0) {
      tc0.textContent = `TC ${tcFormatted} · F:${String(snap.episode_frame_count).padStart(4, "0")}`;
    }

    if (st === "RECORDING") {
      $("ws-dot").className = "status-dot recording";
      gPill.className = "global-rec-pill recording";
      gDot.className = "status-dot recording";
      gText.textContent = `● 녹화 중 (EP #${snap.current_episode})`;
      gTime.textContent = `${tcFormatted} · ${snap.episode_frame_count}f`;

      banner.className = "live-status-banner recording";
      bChip.textContent = "● REC LIVE";
      bHead.textContent = `Episode #${snap.current_episode} 실시간 프레임 기록 중`;
      bSub.innerHTML = `완료 시 <strong>[→ 조기종료]</strong>, 실수 시 <strong>[← 폐기]</strong>를 누르면 모두 환경 Reset으로 이동합니다`;

      vp0.className = "camera-viewport tally-recording";
      vp1.className = "camera-viewport tally-recording";
      tally0.className = "cam-tally-badge recording";
      tally1.className = "cam-tally-badge recording";
      tallyTxt0.textContent = `REC · EP #${snap.current_episode}`;
      tallyTxt1.textContent = `REC · EP #${snap.current_episode}`;

      deckPill.className = "deck-state-pill recording";
      deckPill.textContent = "● RECORDING";
      $("deck-phase-name").textContent = `에피소드 #${snap.current_episode} 기록 진행 중`;
      $("deck-timer").textContent = `${snap.phase_elapsed_s.toFixed(1)}s / ${snap.phase_target_s.toFixed(1)}s`;

      btnStartLbl.textContent = "세션 재시작";
      btnRight.disabled = false;
      btnRight.className = "btn btn-step-reset";
      btnRightLbl.textContent = "조기종료 · Reset 이동";
      btnLeft.disabled = false;
      if (btnLeftLbl) btnLeftLbl.textContent = "폐기 · Reset 이동";
      btnEsc.disabled = false;
    } else if (st === "RESETTING") {
      const remain = Math.max(0, snap.phase_target_s - snap.phase_elapsed_s);
      $("ws-dot").className = "status-dot resetting";
      gPill.className = "global-rec-pill resetting";
      gDot.className = "status-dot resetting";
      gText.textContent = isDiscardReset
        ? `⟳ 폐기됨 · 환경 Reset (EP #${nextEp} 재녹화 대기)`
        : `⟳ 환경 Reset 중 (다음 EP #${nextEp})`;
      gTime.textContent = `${remain.toFixed(1)}s 남음`;

      banner.className = "live-status-banner resetting";
      bChip.textContent = isDiscardReset ? "⟳ DISCARDED · RESET" : "⟳ ENV RESET";
      bHead.textContent = isDiscardReset
        ? `에피소드 폐기 완료 — 물체를 시작 위치로 놓아주세요 (EP #${nextEp} 재녹화 예정)`
        : `Episode #${snap.current_episode} 저장 완료 — 다음 녹화를 위해 환경을 정리해 주세요`;
      bSub.innerHTML = `정리 후 <strong>[▶ 지금 바로 기록 시작 (→)]</strong>을 누르면 즉시 녹화를 시작합니다!`;

      vp0.className = "camera-viewport tally-resetting";
      vp1.className = "camera-viewport tally-resetting";
      tally0.className = "cam-tally-badge resetting";
      tally1.className = "cam-tally-badge resetting";
      tallyTxt0.textContent = "PAUSED · RESET";
      tallyTxt1.textContent = "PAUSED · RESET";

      deckPill.className = "deck-state-pill resetting";
      deckPill.textContent = "⟳ RESETTING";
      $("deck-phase-name").textContent = isDiscardReset
        ? `폐기 후 환경 초기화 중 (0초 도달 또는 → 클릭 시 EP #${nextEp} 재녹화)`
        : `환경 정리 시간 (0초 도달 또는 → 클릭 시 EP #${nextEp} 녹화)`;
      $("deck-timer").textContent = `${remain.toFixed(1)}s 남음 (총 ${snap.phase_target_s.toFixed(0)}s)`;

      btnStartLbl.textContent = "세션 재시작";
      btnRight.disabled = false;
      btnRight.className = "btn btn-step-record-now";
      btnRightLbl.textContent = `▶ 지금 바로 기록 시작 (EP #${nextEp})`;
      btnLeft.disabled = isDiscardReset;
      if (btnLeftLbl) btnLeftLbl.textContent = isDiscardReset ? "Reset 진행 중" : "직전 저장 취소 · Reset";
      btnEsc.disabled = false;
    } else if (st === "COMPLETED") {
      if (state.wsConnected) $("ws-dot").className = "status-dot connected";
      gPill.className = "global-rec-pill completed";
      gDot.className = "status-dot connected";
      gText.textContent = `✓ 수집 완료 (${snap.saved_episodes_count} eps)`;
      gTime.textContent = `${snap.total_saved_frames.toLocaleString()}f`;

      banner.className = "live-status-banner completed";
      bChip.textContent = "✓ COMPLETED";
      bHead.textContent = `수집 및 비디오 인코딩 완료 (${snap.saved_episodes_count}개 에피소드 저장됨)`;
      bSub.textContent = `[데이터셋 v3.0] 탭에서 수집된 에피소드를 확인하세요`;

      vp0.className = "camera-viewport";
      vp1.className = "camera-viewport";
      tally0.className = "cam-tally-badge";
      tally1.className = "cam-tally-badge";

      deckPill.className = "deck-state-pill completed";
      deckPill.textContent = "✓ SAVED";
      $("deck-phase-name").textContent = "비디오 인코딩 및 Parquet 저장 완료";
      $("deck-timer").textContent = `${snap.saved_episodes_count} / ${snap.total_episodes} eps`;

      btnStartLbl.textContent = "새 세션 시작";
      btnRight.disabled = true;
      btnRight.className = "btn btn-step-reset";
      btnRightLbl.textContent = "조기종료 · Reset 이동";
      btnLeft.disabled = true;
      if (btnLeftLbl) btnLeftLbl.textContent = "폐기 · Reset 이동";
      btnEsc.disabled = true;
    } else {
      if (state.wsConnected) $("ws-dot").className = "status-dot connected";
      gPill.className = "global-rec-pill";
      gDot.className = "status-dot";
      gText.textContent = "대기 중 (STANDBY)";
      gTime.textContent = "00:00.0";

      banner.className = "live-status-banner";
      bChip.textContent = "STANDBY";
      bHead.textContent = "세션 대기 중 — [수집 시작]을 누르면 녹화가 시작됩니다";
      bSub.innerHTML = `조기종료(<kbd class="kbd">→</kbd>)와 폐기(<kbd class="kbd">←</kbd>) 모두 안전하게 <strong>환경 Reset</strong>으로 이동합니다`;

      vp0.className = "camera-viewport";
      vp1.className = "camera-viewport";
      tally0.className = "cam-tally-badge";
      tally1.className = "cam-tally-badge";

      deckPill.className = "deck-state-pill";
      deckPill.textContent = "IDLE";
      $("deck-phase-name").textContent = "현재 세션 대기 중";
      $("deck-timer").textContent = `00.0s / ${snap.phase_target_s.toFixed(1)}s`;

      btnStartLbl.textContent = "수집 시작";
      btnRight.disabled = true;
      btnRight.className = "btn btn-step-reset";
      btnRightLbl.textContent = "조기종료 · Reset 이동";
      btnLeft.disabled = true;
      if (btnLeftLbl) btnLeftLbl.textContent = "폐기 · Reset 이동";
      btnEsc.disabled = true;
    }

    $("deck-ep-index").textContent = `${snap.current_episode} / ${snap.total_episodes}`;
    $("deck-frame-count").textContent = snap.episode_frame_count.toLocaleString();
    $("deck-rerecord-count").textContent = snap.rerecord_count;
    $("topbar-ep-count").textContent = `${snap.saved_episodes_count} eps`;
    const navEps = $("nav-saved-eps");
    if (navEps) navEps.textContent = snap.saved_episodes_count;

    // Progress bar: fills 0->100% in RECORDING, drains 100->0% in RESETTING
    let pct = 0;
    if (st === "RECORDING" && snap.phase_target_s > 0) {
      pct = Math.min(100, (snap.phase_elapsed_s / snap.phase_target_s) * 100);
    } else if (st === "RESETTING" && snap.phase_target_s > 0) {
      pct = Math.max(0, 100 - (snap.phase_elapsed_s / snap.phase_target_s) * 100);
    } else if (st === "COMPLETED") {
      pct = 100;
    }
    const bar = $("deck-progress-bar");
    bar.style.width = `${pct}%`;
    bar.className = `progress-fill ${st.toLowerCase()}`;

    // Logs diff update
    const logs = snap.logs || [];
    const lHash = logs.length ? `${logs.length}:${logs[logs.length - 1].ts}:${logs[logs.length - 1].msg}` : "";
    if (lHash !== lastLogHash) {
      lastLogHash = lHash;
      const logEl = $("record-log-stream");
      logEl.innerHTML = logs
        .map(
          (l) =>
            `<div class="log-line"><span class="log-ts">[${l.ts}]</span><span class="log-lvl-${l.level}">[${l.level}]</span><span>${l.msg}</span></div>`
        )
        .join("");
      logEl.scrollTop = logEl.scrollHeight;
    }

    // Episodes table diff update
    const eps = snap.episodes || [];
    const eHash = JSON.stringify(eps.map((e) => `${e.episode_index}:${e.frames}:${e.task}`));
    if (eHash !== lastEpisodeListHash) {
      lastEpisodeListHash = eHash;
      renderEpisodesTable(eps);
    }
  }

  function renderTelemetry(telem, snap) {
    if (!telem) return;
    $("loop-fps-readout").textContent = `${telem.fps_actual.toFixed(1)} Hz`;
    $("latency-badge").textContent = `Loop: ${telem.loop_latency_ms.toFixed(1)} ms · Queue: ${telem.image_writer_queue}`;

    const obs = telem.observation_state || {};
    const act = telem.action || {};
    const keys = Object.keys(obs);

    // Push first joint into waveform history
    if (keys.length > 0) {
      state.telemetryHistory.push({
        obs: obs[keys[0]],
        act: act[keys[0]],
        obs2: obs[keys[Math.min(1, keys.length - 1)]],
      });
      if (state.telemetryHistory.length > 140) state.telemetryHistory.shift();
    }

    // Render Joint Bars
    const barsEl = $("live-joint-bars");
    barsEl.innerHTML = keys
      .slice(0, 8)
      .map((k) => {
        const v = obs[k];
        const a = act[k];
        const norm = Math.max(4, Math.min(96, ((v + 90) / 180) * 100));
        return `
        <div class="joint-row">
          <div class="joint-meta">
            <span>${k}</span>
            <span>obs: ${v.toFixed(1)}° | act: ${a.toFixed(1)}°</span>
          </div>
          <div class="joint-track">
            <div class="joint-fill-obs" style="width:${norm}%"></div>
          </div>
        </div>`;
      })
      .join("");

    drawWaveformCanvas(snap);
    drawCameraSimulationCanvases(obs, snap);
    drawAugmentationPreview(obs);
  }

  function drawWaveformCanvas(snap) {
    const canvas = $("telemetry-wave-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle monochrome center axis
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const hist = state.telemetryHistory;
    if (hist.length < 2) return;

    const plotSeries = (key, color, dashed = false) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.9;
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const x = (idx / 139) * w;
        const y = h / 2 - (pt[key] / 95) * (h * 0.42);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    plotSeries("act", "#a1a1aa", true);
    plotSeries("obs", snap?.state === "RECORDING" ? "#dc2626" : "#09090b", false);
  }

  function drawCameraSimulationCanvases(obs, snap) {
    const vals = Object.values(obs);
    const j0 = (vals[0] || 0) * (Math.PI / 180);
    const j1 = (vals[1] || 0) * (Math.PI / 180);
    const j2 = (vals[2] || 0) * (Math.PI / 180);
    const grip = vals[vals.length - 1] || 35;

    // Camera 0: Bright Architectural Studio Lab Table + Jet-Black 6-DoF Arm
    const c0 = $("cam-canvas-0");
    if (c0) {
      const ctx = c0.getContext("2d");
      const w = c0.width;
      const h = c0.height;
      ctx.fillStyle = "#f4f4f5";
      ctx.fillRect(0, 0, w, h);

      // Crisp white worktable mat with zinc border
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(52, h - 126, w - 104, 84, 10);
      ctx.fill();
      ctx.stroke();

      // Target placement zone (dashed black square)
      ctx.save();
      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(w - 165, h - 106, 72, 46);
      ctx.restore();

      // Target manipulation cube
      const cubeX = 152 + Math.sin(j0) * 34;
      const cubeY = h - 82;
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(cubeX - 12, cubeY - 12, 24, 24);

      // Sleek Jet-Black 6-DoF Follower Arm linkages
      const baseX = w * 0.5;
      const baseY = h - 52;
      const x1 = baseX + Math.sin(j0) * 74;
      const y1 = baseY - 80 - Math.cos(j1) * 16;
      const x2 = x1 + Math.cos(j1 + 0.5) * 68;
      const y2 = y1 - Math.sin(j2 + 0.8) * 50;

      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Crisp white-core black-ringed joints
      [
        [baseX, baseY],
        [x1, y1],
        [x2, y2],
      ].forEach(([jx, jy]) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(jx, jy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      const spread = Math.max(4, (grip / 90) * 18);
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x2 - spread, y2 + 16);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 + spread, y2 + 16);
      ctx.stroke();

      // Drawn corner frame brackets when RECORDING or RESETTING
      if (snap?.state === "RECORDING" || snap?.state === "RESETTING") {
        ctx.strokeStyle = snap.state === "RECORDING" ? "rgba(220, 38, 38, 0.9)" : "rgba(9, 9, 11, 0.85)";
        ctx.lineWidth = 2.5;
        const m = 18, len = 18;
        ctx.beginPath();
        ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
        ctx.moveTo(w - m - len, m); ctx.lineTo(w - m, m); ctx.lineTo(w - m, m + len);
        ctx.moveTo(m, h - m - len); ctx.lineTo(m, h - m); ctx.lineTo(m + len, h - m);
        ctx.moveTo(w - m - len, h - m); ctx.lineTo(w - m, h - m); ctx.lineTo(w - m, h - m - len);
        ctx.stroke();
      }
    }

    // Camera 1: Clean Light Studio Wrist Eye-in-Hand View
    const c1 = $("cam-canvas-1");
    if (c1) {
      const ctx = c1.getContext("2d");
      const w = c1.width;
      const h = c1.height;
      ctx.fillStyle = "#f1f1f3";
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2 + Math.sin(j0) * 48;
      const cy = h / 2 + Math.cos(j1) * 28;

      // Minimal monochrome crosshair reticle
      ctx.strokeStyle = "rgba(9, 9, 11, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 30, h / 2);
      ctx.lineTo(w / 2 + 30, h / 2);
      ctx.moveTo(w / 2, h / 2 - 30);
      ctx.lineTo(w / 2, h / 2 + 30);
      ctx.stroke();

      // Cube from wrist perspective
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(cx - 26, cy - 26, 52, 52);

      // Jet-black gripper fingers in foreground
      const fingerGap = 36 + (grip / 90) * 55;
      ctx.fillStyle = "#18181b";
      ctx.fillRect(w / 2 - fingerGap - 16, h - 76, 16, 76);
      ctx.fillRect(w / 2 + fingerGap, h - 76, 16, 76);
    }
  }

  function drawAugmentationPreview(obs) {
    const augCanvas = $("aug-preview-canvas");
    const srcCanvas = $("cam-canvas-0");
    if (!augCanvas || !srcCanvas) return;

    const b = Number($("aug-bright").value) / 100;
    const c = Number($("aug-contrast").value) / 100;
    const s = Number($("aug-sat").value) / 100;
    const h = Number($("aug-hue").value);

    $("val-aug-bright").textContent = b.toFixed(2);
    $("val-aug-contrast").textContent = c.toFixed(2);
    $("val-aug-sat").textContent = s.toFixed(2);
    $("val-aug-hue").textContent = `${h} deg`;

    const ctx = augCanvas.getContext("2d");
    ctx.save();
    ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
    ctx.drawImage(srcCanvas, 0, 0, augCanvas.width, augCanvas.height);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 7. Hardware Scanners & Calibration / Teleop / Dataset / Train / Async Builders
  // -------------------------------------------------------------------------
  async function scanPortsOrCameras(kind) {
    const tbody = $("hw-scan-tbody");
    if (kind === "ports") {
      const resp = await fetch("/api/v044/hardware/scan-ports");
      const data = await resp.json();
      tbody.innerHTML = data.ports
        .map(
          (p, idx) => `
        <tr>
          <td style="font-family:var(--font-mono); color:var(--accent-cyan);">${p.port}</td>
          <td>${p.device}</td>
          <td><span class="badge ${p.source === "hardware" ? "green" : "amber"}">${p.source}</span></td>
          <td>
            <button type="button" class="btn" data-assign-port="${p.port}" data-role="${idx === 0 ? "robot" : "teleop"}" style="padding:3px 8px; font-size:11px;">
              ${idx === 0 ? "Follower 할당" : "Leader 할당"}
            </button>
          </td>
        </tr>`
        )
        .join("");

      tbody.querySelectorAll("[data-assign-port]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const port = btn.dataset.assignPort;
          if (btn.dataset.role === "robot") {
            $("rec-robot-port").value = port;
          } else {
            $("rec-teleop-port").value = port;
          }
          refreshRecordValidation();
          btn.textContent = "할당 완료 ✓";
        });
      });
    } else {
      const resp = await fetch("/api/v044/hardware/scan-cameras");
      const data = await resp.json();
      tbody.innerHTML = data.cameras
        .map(
          (c) => `
        <tr>
          <td style="font-family:var(--font-mono); color:var(--accent-amber);">${c.type}:${c.path}</td>
          <td>${c.name || c.backend} (${c.width}×${c.height} @ ${c.fps}fps)</td>
          <td><span class="badge ${c.source === "hardware" ? "green" : "cyan"}">${c.source}</span></td>
          <td><span style="font-size:11px; color:var(--text-muted);">Ready</span></td>
        </tr>`
        )
        .join("");
    }
  }

  function rebuildTeleopSliders() {
    const rType = $("rec-robot-type").value || "so101_follower";
    const found = (state.catalog?.robots || []).find((r) => r.type === rType);
    const joints = found ? found.joints.slice(0, 6) : ["shoulder_pan.pos", "shoulder_lift.pos", "elbow_flex.pos", "wrist_flex.pos", "wrist_roll.pos", "gripper.pos"];

    const container = $("teleop-slider-list");
    container.innerHTML = joints
      .map(
        (j) => `
      <div class="form-field">
        <label>${j} <span class="flag-hint" id="offset-lbl-${j}">0°</span></label>
        <input type="range" min="-45" max="45" value="0" data-joint="${j}" />
      </div>`
      )
      .join("");

    container.querySelectorAll("input[type='range']").forEach((rng) => {
      rng.addEventListener("input", (e) => {
        const j = e.target.dataset.joint;
        const v = Number(e.target.value);
        const lbl = $(`offset-lbl-${j}`);
        if (lbl) lbl.textContent = `${v > 0 ? "+" : ""}${v}°`;
        sendSessionControl("set_joint_offset", { joint: j, value: v });
      });
    });
  }

  function renderEpisodesTable(episodes) {
    const tbody = $("dataset-episodes-tbody");
    if (!tbody) return;
    if (!episodes.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); text-align:center;">수집된 에피소드가 없습니다. 1번 탭에서 수집 세션을 시작해 보세요.</td></tr>`;
      return;
    }
    tbody.innerHTML = episodes
      .map(
        (ep) => `
      <tr>
        <td><input type="checkbox" class="ep-del-check" value="${ep.episode_index}" /></td>
        <td style="font-family:var(--font-mono); font-weight:600;">#${ep.episode_index}</td>
        <td>${ep.task}</td>
        <td style="font-family:var(--font-mono);">${ep.frames} f (${ep.duration_s}s)</td>
        <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary);">${ep.chunk}</td>
      </tr>`
      )
      .join("");
  }

  async function refreshAllSecondaryBuilders() {
    // 1. Setup Motors
    const mResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "setup_motors",
        role: $("motor-role").value,
        type: $("motor-dev-type").value,
        port: $("motor-port").value,
      }),
    });
    $("motor-setup-cmd").textContent = (await mResp.json()).cli_command;

    // 2. Calibrate
    const cResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "calibrate",
        role: $("cal-role").value,
        type: $("cal-type").value,
        port: $("cal-port").value,
        id: $("cal-id").value,
      }),
    });
    const cJson = await cResp.json();
    $("cal-cmd-box").textContent = cJson.cli_command;
    $("cal-file-path").textContent = cJson.calibration_file;

    // 3. Teleoperate
    const tResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "teleoperate",
        robot_type: $("rec-robot-type").value,
        robot_port: $("rec-robot-port").value,
        robot_id: $("rec-robot-id").value,
        cameras: state.cameras,
        teleop_type: $("rec-teleop-type").value,
        teleop_port: $("rec-teleop-port").value,
        teleop_id: $("rec-teleop-id").value,
        fps: 60,
        display_data: true,
      }),
    });
    $("teleop-cmd-box").textContent = (await tResp.json()).cli_command;

    // 4. Replay
    const rResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "replay",
        robot_type: $("rec-robot-type").value,
        robot_port: $("replay-robot-port").value,
        robot_id: $("rec-robot-id").value,
        repo_id: $("replay-repo-id").value,
        episode: Number($("replay-ep-idx").value) || 0,
      }),
    });
    $("replay-cmd-box").textContent = (await rResp.json()).cli_command;

    // 5. Train
    const pType = $("tr-policy-type").value || "act";
    const pMeta = (state.catalog?.policies || []).find((p) => p.type === pType);
    if (pMeta) {
      $("policy-vram-badge").textContent = `권장 VRAM: ${pMeta.vram} · ${pMeta.extra}`;
      $("tr-policy-desc").textContent = pMeta.highlight;
    }
    const trResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "train",
        dataset_repo_id: $("tr-dataset").value,
        policy_type: pType,
        device: $("tr-device").value,
        policy_repo_id: $("tr-policy-repo").value,
        output_dir: $("tr-outdir").value,
        job_name: `${pType}_train_job`,
        steps: Number($("tr-steps").value) || 100000,
        batch_size: Number($("tr-batch").value) || 8,
        use_peft: $("tr-peft").checked,
        wandb_enable: $("tr-wandb").checked,
        push_to_hub: $("tr-push").checked,
      }),
    });
    $("train-cmd-box").textContent = (await trResp.json()).cli_command;

    // 6. Eval
    const evResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "eval",
        policy_path: $("ev-policy-path").value,
        env_type: $("ev-env-type").value,
        env_task: $("ev-env-task").value,
        batch_size: Number($("ev-batch").value) || 2,
        n_episodes: Number($("ev-eps").value) || 10,
      }),
    });
    $("eval-cmd-box").textContent = (await evResp.json()).cli_command;

    // 7. Async Inference
    const asResp = await fetch("/api/v044/builder/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "async_inference",
        host: $("as-host").value,
        port: Number($("as-port").value) || 8080,
        robot_type: $("rec-robot-type").value,
        robot_port: $("rec-robot-port").value,
        robot_id: $("rec-robot-id").value,
        task: $("rec-single-task").value,
        policy_type: $("as-policy-type").value,
        policy_path: $("as-policy-path").value,
        actions_per_chunk: Number($("as-chunk").value) || 50,
        chunk_size_threshold: Number($("as-thresh").value) || 0.5,
        aggregate_fn_name: $("as-agg").value,
      }),
    });
    const asJson = await asResp.json();
    $("async-server-cmd").textContent = asJson.server_command;
    $("async-client-cmd").textContent = asJson.client_command;
  }

  function setupSecondaryListeners() {
    $("btn-scan-ports").addEventListener("click", () => scanPortsOrCameras("ports"));
    $("btn-scan-cams").addEventListener("click", () => scanPortsOrCameras("cams"));

    $("btn-reset-offsets").addEventListener("click", () => {
      document.querySelectorAll("#teleop-slider-list input[type='range']").forEach((rng) => {
        rng.value = 0;
        const j = rng.dataset.joint;
        const lbl = $(`offset-lbl-${j}`);
        if (lbl) lbl.textContent = "0°";
        sendSessionControl("set_joint_offset", { joint: j, value: 0 });
      });
    });

    // Dataset Edit Operation Defaults
    const opPlaceholders = {
      delete_episodes: { label: "삭제할 에피소드 인덱스 리스트 (`--operation.episode_indices`)", val: "[0]" },
      split: { label: "분할 비율 또는 인덱스 JSON (`--operation.splits`)", val: '{"train": 0.8, "val": 0.2}' },
      merge: { label: "병합할 소스 저장소 리스트 (`--operation.repo_ids`)", val: "['lerobot_user/session_1', 'lerobot_user/session_2']" },
      remove_feature: { label: "제거할 피처 이름 리스트 (`--operation.feature_names`)", val: "['observation.images.wrist']" },
      modify_tasks: { label: "새 작업 자연어 지시문 (`--operation.new_task`)", val: "Pick up the red block and place it cleanly in the bin" },
      convert_image_to_video: { label: "인코딩 비디오 코덱", val: "libsvtav1" },
    };

    $("ds-op-type").addEventListener("change", () => {
      const op = $("ds-op-type").value;
      const meta = opPlaceholders[op];
      if (meta) {
        $("ds-op-arg-label").textContent = meta.label;
        $("ds-op-arg").value = meta.val;
      }
      runDatasetEditBuilder(false);
    });

    $("btn-run-ds-edit").addEventListener("click", () => runDatasetEditBuilder(true));

    $("btn-delete-selected-eps").addEventListener("click", async () => {
      const checked = Array.from(document.querySelectorAll(".ep-del-check:checked")).map((el) => Number(el.value));
      if (!checked.length) {
        $("ds-edit-feedback").textContent = "삭제할 에피소드 체크박스를 먼저 선택하세요.";
        return;
      }
      $("ds-op-type").value = "delete_episodes";
      $("ds-op-arg").value = JSON.stringify(checked);
      await runDatasetEditBuilder(true, checked);
    });

    // Bind secondary form inputs
    [
      "motor-role", "motor-dev-type", "motor-port",
      "cal-role", "cal-type", "cal-port", "cal-id",
      "replay-repo-id", "replay-ep-idx", "replay-robot-port",
      "tr-policy-type", "tr-dataset", "tr-policy-repo", "tr-device",
      "tr-steps", "tr-batch", "tr-outdir", "tr-peft", "tr-wandb", "tr-push",
      "ev-policy-path", "ev-env-type", "ev-env-task", "ev-batch", "ev-eps",
      "as-host", "as-port", "as-policy-type", "as-policy-path", "as-chunk", "as-thresh", "as-agg",
    ].forEach((id) => {
      $(id).addEventListener("input", refreshAllSecondaryBuilders);
      $(id).addEventListener("change", refreshAllSecondaryBuilders);
    });

    // Update default task when sim env changes
    $("ev-env-type").addEventListener("change", () => {
      const eType = $("ev-env-type").value;
      const envMeta = (state.catalog?.sim_envs || []).find((e) => e.type === eType);
      if (envMeta && envMeta.tasks?.length) {
        $("ev-env-task").value = envMeta.tasks[0];
      }
      refreshAllSecondaryBuilders();
    });

    runDatasetEditBuilder(false);
  }

  async function runDatasetEditBuilder(applyMutation = false, explicitIndices = null) {
    const op = $("ds-op-type").value;
    const rawArg = $("ds-op-arg").value.trim();
    const payload = {
      operation_type: op,
      repo_id: $("ds-edit-repo").value.trim(),
      new_repo_id: $("ds-edit-new-repo").value.trim(),
      push_to_hub: $("ds-push-hub").checked,
    };

    if (op === "delete_episodes") {
      if (applyMutation) {
        try {
          payload.episode_indices = explicitIndices || JSON.parse(rawArg);
        } catch {
          payload.episode_indices = [];
        }
      } else {
        payload.episode_indices = [];
      }
    } else if (op === "split") {
      payload.splits = rawArg;
    } else if (op === "merge") {
      payload.repo_ids = rawArg;
    } else if (op === "remove_feature") {
      payload.feature_names = rawArg;
    } else if (op === "modify_tasks") {
      payload.new_task = rawArg;
    }

    const resp = await fetch("/api/v044/dataset/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res = await resp.json();
    $("ds-edit-cmd-box").textContent = res.cli_command;
    if (applyMutation) {
      $("ds-edit-feedback").textContent = `✓ ${res.message}`;
      renderEpisodesTable(res.episodes || []);
    }
  }

  // -------------------------------------------------------------------------
  // Boot Application
  // -------------------------------------------------------------------------
  window.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupRecordControls();
    setupSecondaryListeners();
    await loadCatalog();
    connectWebSocket();
  });
})();
