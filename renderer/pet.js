/* ============================================
   Desktop Pet — State Machine + Core Logic
   ============================================ */

class PetStateMachine {
  // ---- State constants ----
  static IDLE  = "idle";
  static TOUCH = "touch";
  static NAP   = "nap";

  // ---- Messages per state ----
  static MESSAGES = {
    idle:  ["今天天气不错喵~", "好无聊喵…", "你在做什么喵？", "关注塔菲喵", "来找我玩吧喵！"],
    touch: ["别摸啦",  "嘻嘻", "住手喵！"],
    nap:   ["zzz",  "💤"],
  };

  // ---- Animation frame configs ----
  static FRAMES = {
    idle:   { dir: "idle",   prefix: "idle",   count: 4, interval: 150 },
    touch1: { dir: "touch",  prefix: "touch1", count: 3, interval: 200 },
    touch2: { dir: "touch",  prefix: "touch2", count: 4, interval: 200 },
    nap:    { dir: "nap",    prefix: "nap",    count: 3, interval: 400 },
  };

  // ---- Auto-recovery timeouts (ms) ----
  static RECOVER_TIMEOUTS = {
    touch: 1200,
  };

  // ---- Timing ----
  static IDLE_CYCLE_INTERVAL = 3000;   // idle animation loop every 3s
  static NAP_INACTIVITY_MS   = 10000;  // 10s no interaction → nap

  constructor(sprite, hitEl, bubble, bubbleText) {
    // DOM
    this.sprite = sprite;
    this.hitEl  = hitEl;
    this.bubble = bubble;
    this.bubbleText = bubbleText;

    // Current state
    this.state = PetStateMachine.IDLE;

    // Timers
    this._idleCycleTimer  = null;
    this._idleFrameTimer  = null;
    this._recoverTimer    = null;
    this._speechTimer     = null;
    this._idleActionTimer = null;
    this._napAnimTimer    = null;
    this._touchAnimTimer   = null;
    this._inactivityTimer  = null;

    // Touch detection
    this._mouseOver = false;

    // Interaction tracking (for nap)
    this._lastInteraction = Date.now();

    // Preloaded images
    this._preloaded = {};

    // Boot
    this._preloadAllFrames();
    this._setState(PetStateMachine.IDLE);
    this._startIdleAnimation();
    this._resetIdleActionTimer();
    this._startInactivityMonitor();
    this._bindEvents();
  }

  // ================================================================
  //  PUBLIC API
  // ================================================================

  setState(newState, opts = {}) {
    this._setState(newState, opts);
  }

  /** Call on any user interaction to reset nap timer */
  interact() {
    this._lastInteraction = Date.now();
    if (this.state === PetStateMachine.NAP) {
      this._setState(PetStateMachine.IDLE);
    }
  }

  showSpeech(text, duration = 3000) {
    this._showSpeech(text, duration);
  }

  destroy() {
    this._clearAllTimers();
  }

  // ================================================================
  //  STATE TRANSITION
  // ================================================================

  _setState(newState, opts = {}) {
    if (this.state === newState) return;

    const prev = this.state;

    // Teardown previous state
    this._teardownState(prev);

    // Switch
    this.sprite.classList.remove(`state-${prev}`);
    this.state = newState;
    this.sprite.classList.add(`state-${newState}`);

    // Setup new state
    this._setupState(newState, opts);

    // Record interaction unless going to nap
    if (newState !== PetStateMachine.NAP) {
      this._lastInteraction = Date.now();
    }

    // Show message
    const msgs = PetStateMachine.MESSAGES[newState];
    if (msgs && msgs.length > 0) {
      this._showSpeech(msgs[Math.floor(Math.random() * msgs.length)]);
    }

    // Schedule auto-recovery
    const timeout = PetStateMachine.RECOVER_TIMEOUTS[newState];
    if (timeout) {
      this._recoverTimer = setTimeout(() => {
        if (this.state === newState) {
          this._setState(PetStateMachine.IDLE);
        }
      }, timeout);
    }
  }

  _teardownState(state) {
    switch (state) {
      case PetStateMachine.IDLE:
        this._stopIdleAnimation();
        break;
      case PetStateMachine.TOUCH:
        this._stopTouchAnimation();
        break;
      case PetStateMachine.NAP:
        this._stopNapAnimation();
        break;
    }
    clearTimeout(this._recoverTimer);
    this._recoverTimer = null;
  }

  _setupState(state, opts) {
    switch (state) {
      case PetStateMachine.IDLE:
        this._startIdleAnimation();
        this._resetIdleActionTimer();
        break;
      case PetStateMachine.TOUCH: {
        const variant = opts.variant || (Math.random() < 0.5 ? "touch1" : "touch2");
        this._startTouchAnimation(variant);
        break;
      }
      case PetStateMachine.NAP:
        this._startNapAnimation();
        break;
    }
  }

  // ================================================================
  //  IDLE ANIMATION  (3s cycle)
  // ================================================================

  _startIdleAnimation() {
    this._stopIdleAnimation();
    this._setSpriteBg(PetStateMachine.FRAMES.idle, 0);
    this._scheduleIdleCycle();
  }

  _stopIdleAnimation() {
    clearTimeout(this._idleCycleTimer);
    clearInterval(this._idleFrameTimer);
    this._idleCycleTimer = null;
    this._idleFrameTimer = null;
    this.sprite.style.backgroundImage = "";
  }

  _scheduleIdleCycle() {
    this._idleCycleTimer = setTimeout(() => {
      if (this.state !== PetStateMachine.IDLE) return;
      this._playIdleCycle();
    }, PetStateMachine.IDLE_CYCLE_INTERVAL);
  }

  _playIdleCycle() {
    const cfg = PetStateMachine.FRAMES.idle;
    let frame = 0;
    this._idleFrameTimer = setInterval(() => {
      frame++;
      if (frame >= cfg.count) {
        clearInterval(this._idleFrameTimer);
        this._idleFrameTimer = null;
        this._setSpriteBg(cfg, 0);
        this._scheduleIdleCycle();
        return;
      }
      this._setSpriteBg(cfg, frame);
    }, cfg.interval);
  }

  // ================================================================
  //  TOUCH ANIMATION
  // ================================================================

  _startTouchAnimation(variant) {
    this._stopTouchAnimation();
    const cfg = PetStateMachine.FRAMES[variant];
    let frame = 0;
    this._setSpriteBg(cfg, 0);
    this._touchAnimTimer = setInterval(() => {
      frame++;
      if (frame >= cfg.count) {
        frame = 0;
      }
      this._setSpriteBg(cfg, frame);
    }, cfg.interval);
  }

  _stopTouchAnimation() {
    clearInterval(this._touchAnimTimer);
    this._touchAnimTimer = null;
    this.sprite.style.backgroundImage = "";
  }

  // ================================================================
  //  NAP ANIMATION  (continuous loop)
  // ================================================================

  _startNapAnimation() {
    this._stopNapAnimation();
    const cfg = PetStateMachine.FRAMES.nap;
    let frame = 0;
    this._setSpriteBg(cfg, 0);
    this._napAnimTimer = setInterval(() => {
      frame = (frame + 1) % cfg.count;
      this._setSpriteBg(cfg, frame);
    }, cfg.interval);
  }

  _stopNapAnimation() {
    clearInterval(this._napAnimTimer);
    this._napAnimTimer = null;
    this.sprite.style.backgroundImage = "";
  }

  // ================================================================
  //  IDLE RANDOM ACTIONS
  // ================================================================

  _resetIdleActionTimer() {
    clearTimeout(this._idleActionTimer);
    if (this.state !== PetStateMachine.IDLE) return;
    const delay = 4000 + Math.random() * 8000;
    this._idleActionTimer = setTimeout(() => this._idleAction(), delay);
  }

  _idleAction() {
    if (this.state !== PetStateMachine.IDLE) return;
    const roll = Math.random();
    if (roll < 0.35) {
      const msgs = PetStateMachine.MESSAGES[PetStateMachine.IDLE];
      this._showSpeech(msgs[Math.floor(Math.random() * msgs.length)]);
    } else if (roll < 0.65) {
      this.sprite.style.transform = `translateX(${(Math.random() - 0.5) * 16}px)`;
      setTimeout(() => { this.sprite.style.transform = ""; }, 400);
    } else if (roll < 0.80) {
      this._setState(PetStateMachine.TOUCH);
      return;
    } else {
      this._setState(PetStateMachine.NAP);
      return;
    }
    this._resetIdleActionTimer();
  }

  // ================================================================
  //  MOUSE TRACKING
  // ================================================================

  _onMouseEnter() {
    this._mouseOver = true;
    // No interact() here — hovering does NOT wake from nap
  }

  _onMouseLeave() {
    this._mouseOver = false;
  }

  /** Trigger a single touch animation on mouse-up */
  _onMouseUp() {
    // Wake from nap without triggering touch
    if (this.state === PetStateMachine.NAP) {
      this.interact();
      return;
    }
    this.interact();
    const variant = Math.random() < 0.5 ? "touch1" : "touch2";
    this._setState(PetStateMachine.TOUCH, { variant });
  }

  // ================================================================
  //  INACTIVITY → NAP MONITOR
  // ================================================================

  _startInactivityMonitor() {
    this._inactivityTimer = setInterval(() => {
      if (this.state === PetStateMachine.NAP) return;
      const elapsed = Date.now() - this._lastInteraction;
      if (elapsed >= PetStateMachine.NAP_INACTIVITY_MS) {
        this._setState(PetStateMachine.NAP);
      }
    }, 1000);
  }

  // ================================================================
  //  SPEECH BUBBLE
  // ================================================================

  _showSpeech(text, duration = 3000) {
    this.bubbleText.textContent = text;
    this.bubble.classList.remove("hidden");
    clearTimeout(this._speechTimer);
    this._speechTimer = setTimeout(() => {
      this.bubble.classList.add("hidden");
    }, duration);
  }

  // ================================================================
  //  HELPERS
  // ================================================================

  _setSpriteBg(cfg, index) {
    const src = `../assets/${cfg.dir}/${cfg.prefix}.${index + 1}.png`;
    this.sprite.style.backgroundImage = `url("${src}")`;
  }

  _preloadAllFrames() {
    for (const [key, cfg] of Object.entries(PetStateMachine.FRAMES)) {
      this._preloaded[key] = [];
      for (let i = 0; i < cfg.count; i++) {
        const img = new Image();
        img.src = `../assets/${cfg.dir}/${cfg.prefix}.${i + 1}.png`;
        this._preloaded[key].push(img);
      }
    }
  }

  _clearAllTimers() {
    [
      "_idleCycleTimer", "_idleFrameTimer", "_recoverTimer",
      "_speechTimer", "_idleActionTimer", "_napAnimTimer",
      "_touchAnimTimer", "_inactivityTimer",
    ].forEach((k) => {
      if (k.endsWith("Timer") && typeof this[k] === "number") {
        clearTimeout(this[k]);
        clearInterval(this[k]);
      }
      this[k] = null;
    });
  }

  // ================================================================
  //  EVENT BINDING
  // ================================================================

  _bindEvents() {
    // Mouse enter/leave for nap interaction
    this.hitEl.addEventListener("mouseenter", () => this._onMouseEnter());
    this.hitEl.addEventListener("mouseleave", () => this._onMouseLeave());

    // Mouse-up → single touch animation (once per click)
    this.hitEl.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return;
      this._onMouseUp();
    });
  }
}

// ================================================================
//  BOOTSTRAP — wire class to DOM & existing window plumbing
// ================================================================

(function boot() {
  // DOM
  const petContainer = document.getElementById("pet-container");
  const petBody      = document.getElementById("pet-body");
  const petSprite    = document.getElementById("pet-sprite");
  const petHit       = document.getElementById("pet-hit");
  const speechBubble = document.getElementById("speech-bubble");
  const bubbleText   = document.getElementById("bubble-text");
  const contextMenu  = document.getElementById("context-menu");

  // Create state machine (hitEl for interaction, sprite for display)
  const sm = new PetStateMachine(petSprite, petHit, speechBubble, bubbleText);

  // ---- Drag ----
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  petHit.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStart = { x: e.screenX, y: e.screenY };
    petHit.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.screenX - dragStart.x;
    const deltaY = e.screenY - dragStart.y;
    // Ignore sub-pixel drift (e.g. holding button still)
    if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return;
    dragStart = { x: e.screenX, y: e.screenY };
    window.petAPI.moveWindow(deltaX, deltaY);
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      petHit.style.cursor = "grab";
    }
    if (isBubbleDragging) {
      isBubbleDragging = false;
      speechBubble.style.cursor = "grab";
    }
  });

  // ---- Bubble Drag (independent from zoom) ----
  let isBubbleDragging = false;
  let bubbleDragStart = { x: 0, y: 0, left: 0, top: 0 };

  speechBubble.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isBubbleDragging = true;
    bubbleDragStart = {
      x: e.clientX,
      y: e.clientY,
      left: speechBubble.offsetLeft,
      top: speechBubble.offsetTop,
    };
    speechBubble.style.cursor = "grabbing";
    speechBubble.style.transform = "none";
    e.stopPropagation();
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isBubbleDragging) return;
    const deltaX = e.clientX - bubbleDragStart.x;
    const deltaY = e.clientY - bubbleDragStart.y;
    speechBubble.style.left = (bubbleDragStart.left + deltaX) + "px";
    speechBubble.style.top  = (bubbleDragStart.top  + deltaY) + "px";
  });

  // ---- Context Menu ----
  petHit.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    sm.interact();
    showContextMenu();
  });

  function showContextMenu() {
    const winX = window.screenX;
    const winY = window.screenY;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    contextMenu.classList.remove("hidden");

    requestAnimationFrame(() => {
      const menuW = contextMenu.offsetWidth;
      const menuH = contextMenu.offsetHeight;

      let left = (winW - menuW) / 2;
      let top  = (winH - menuH) / 2;

      const screenW = window.screen.availWidth;
      const screenH = window.screen.availHeight;

      if (winX + left + menuW > screenW) left -= (winX + left + menuW - screenW) + 4;
      if (winX + left < 0)               left = 4 - winX;
      if (winY + top + menuH > screenH)  top  -= (winY + top + menuH - screenH) + 4;
      if (winY + top < 0)                top  = 4 - winY;

      contextMenu.style.left = left + "px";
      contextMenu.style.top  = top + "px";
      contextMenu.style.transform = "none";
    });
  }

  document.addEventListener("click", (e) => {
    if (!contextMenu.contains(e.target) && e.target !== petHit) {
      contextMenu.classList.add("hidden");
    }
  });

  contextMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".menu-item");
    if (!item) return;
    const action = item.dataset.action;
    contextMenu.classList.add("hidden");
    sm.interact();

    switch (action) {
      case "idle":
        sm.setState(PetStateMachine.IDLE);
        break;
      case "speak": {
        const msgs = PetStateMachine.MESSAGES[sm.state] || PetStateMachine.MESSAGES.idle;
        if (msgs.length > 0) {
          sm.showSpeech(msgs[Math.floor(Math.random() * msgs.length)]);
        }
        break;
      }
      case "quit":
        sm.showSpeech("拜拜~ ", 2000);
        setTimeout(() => window.close(), 1500);
        break;
    }
  });

  // ---- Keyboard shortcuts ----
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    sm.interact();
    switch (e.key.toLowerCase()) {
      case "i": sm.setState(PetStateMachine.IDLE);  break;
      case "t": sm.setState(PetStateMachine.TOUCH); break;
      case "n": sm.setState(PetStateMachine.NAP);   break;
      case "+":
      case "=": zoomIn();  break;
      case "-": zoomOut(); break;
      case "0": zoomReset(); break;
    }
  });

  // ---- Zoom (kept outside state machine — it's a view concern) ----
  const SPRITE_SIZE = 64;
  //最小最大缩放
  const ZOOM_MIN = 0.5;
  const ZOOM_STEP = 0.1;
  let   zoomMax = 3.0;
  let   zoomLevel = 3.0;

  function updateZoomMax() {
    zoomMax = Math.floor(Math.min(window.innerWidth, window.innerHeight) / SPRITE_SIZE * 10) / 10;
    if (zoomLevel > zoomMax) { zoomLevel = zoomMax; applyZoom(); }
  }
  const BG_RATIO = 0.5;  // matches CSS background-size: 50%

  function syncPetSize() {
    const vw = Math.round(SPRITE_SIZE * BG_RATIO * zoomLevel);
    const vh = Math.round(SPRITE_SIZE * BG_RATIO * zoomLevel);
    window.petAPI.setPetSize(vw, vh);
    positionBubble(vh);
  }
  function positionBubble(charVisualH) {
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    const charTop = (winH - charVisualH) / 2;
    // Bubble ~25px tall at 14px font, 5px gap above character
    speechBubble.style.top = Math.round(charTop - 30) + "px";
    // Center horizontally
    speechBubble.style.left = Math.round(winW / 2 - 84) + "px";
    speechBubble.style.transform = "none";
  }
  function applyZoom() { petBody.style.transform = `scale(${zoomLevel})`; syncPetSize(); }
  function zoomIn()   { zoomLevel = Math.min(zoomMax, zoomLevel + ZOOM_STEP); applyZoom(); }
  function zoomOut()  { zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP); applyZoom(); }
  function zoomReset() { zoomLevel = 4.0; if (zoomLevel > zoomMax) zoomLevel = zoomMax; applyZoom(); }

  updateZoomMax();
  applyZoom();
  window.addEventListener("resize", updateZoomMax);

  // ---- Image fallback detection ----
  petSprite.setAttribute("data-has-image", "true");
})();
