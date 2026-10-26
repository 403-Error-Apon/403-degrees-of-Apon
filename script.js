(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toastRegion = $("#toastRegion");
  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalEyebrow = $("#modalEyebrow");
  const modalIcon = $("#modalIcon");
  const themeOverlay = $("#themeOverlay");
  const markerToggle = $("#markerToggle");
  const markerState = $("#markerState");
  let secretClickCount = 0;
  let secretResetTimer = null;
  let themeActive = false;
  let watcherClicks = 0;
  let watcherSilent = false;
  let watcherIsAvoiding = false;
  let watcherTimer = null;
  let watcherPeekTimer = null;
  let bubbleTimer = null;
  let modalTrigger = null;
  let typedBuffer = "";

  const statuses = [
    ["Curiosity detected.", "Go on, make questionable decisions."],
    ["Suspicious activity.", "You’re clicking things again, aren’t you?"],
    ["Snack-related thinking.", "My academic responsibility has gone missing."],
    ["Everything is normal.", "I reviewed this message myself. That means nothing."],
    ["Side quest detected.", "Reward: a tiny amount of satisfaction."],
    ["Apon.exe is running.", "Stability is not guaranteed."]
  ];

  function showToast(message, duration = 3000) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(6px)";
      window.setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  function openModal({ title, body, eyebrow = "A LITTLE INTERRUPTION FROM ME", icon = "✳" }) {
    modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalEyebrow.textContent = eyebrow;
    modalIcon.textContent = icon;
    if (typeof modal.showModal === "function") {
      if (!modal.open) modal.showModal();
    } else showToast(`${title} ${body}`);
  }
  function closeModal() { if (modal.open) modal.close(); }
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOkay").addEventListener("click", closeModal);
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  modal.addEventListener("close", () => {
    if (modalTrigger && document.contains(modalTrigger)) modalTrigger.focus({ preventScroll: true });
    modalTrigger = null;
  });

  // Compact navigation for mobile layouts.
  const menuButton = $("#menuButton");
  const siteNav = $("#siteNav");
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
    siteNav.classList.toggle("is-open", !open);
  });
  $$("#siteNav a").forEach(link => link.addEventListener("click", () => {
    menuButton.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
  }));

  const aboutCopy = "I am a first year DU Criminology student. I like meeting people, horror series, eating whatever I want, and doing silly, slightly sneaky things. This website is one of them. Please investigate responsibly.";
  function showAbout() {
    openModal({ eyebrow: "A LITTLE ABOUT ME / FILE Nº 403", title: "So, you want to know who I am?", body: aboutCopy, icon: "⌕" });
  }
  $("#aboutButton").addEventListener("click", showAbout);

  // Marker mode is deliberately interactive: hover, tap, or select the bits you like.
  function setMarkerMode(active) {
    document.body.classList.toggle("highlight-mode", active);
    markerToggle.setAttribute("aria-pressed", String(active));
    markerState.textContent = active ? "on" : "off";
    if (active) showToast("Marker mode is on. Tap a highlight to make it stay.", 2300);
  }
  markerToggle.addEventListener("click", () => setMarkerMode(markerToggle.getAttribute("aria-pressed") !== "true"));
  $("#labToggle").addEventListener("click", () => setMarkerMode(markerToggle.getAttribute("aria-pressed") !== "true"));
  $$("[data-highlight]").forEach(mark => {
    mark.setAttribute("role", "button");
    mark.setAttribute("tabindex", "0");
    mark.setAttribute("aria-label", `Toggle highlight: ${mark.textContent.trim()}`);
    const toggle = () => mark.classList.toggle("is-marked");
    mark.addEventListener("click", toggle);
    mark.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
    });
  });

  // Clickable oddities.
  $("#watchButton").addEventListener("click", () => openModal({
    eyebrow: "OBSERVATION LOG / 001", title: "I think it noticed you noticing.",
    body: "Don't worry, it's a CSS eye. It has no camera, no access to your files, and absolutely no useful information. Unlike me, it has no idea what you're doing here.", icon: "◉"
  }));
  $("#dontClickButton").addEventListener("click", () => openModal({
    eyebrow: "UNAUTHORIZED BUTTON PRESS", title: "I literally told you not to.",
    body: "ACCESS DENIED. REASON: I AM BEING SILLY AGAIN. Reflect on your choices for approximately half a second. Or click again. I'm not your supervisor.", icon: "⚠"
  }));
  $$("[data-modal]").forEach(button => button.addEventListener("click", () => {
    const type = button.dataset.modal;
    if (type === "eye") openModal({ eyebrow: "OBJECT 001 / EYE REPORT", title: "It is looking directly at you.", body: "Just a small drawing. No camera, no tracking, no secrets. The only thing it knows is that you clicked a button with an eye on it. Excellent detective work.", icon: "◉" });
    if (type === "button") openModal({ eyebrow: "OBJECT 002 / INCIDENT REPORT", title: "You clicked it twice.", body: "There is no lesson here. Sometimes a button just needs to be clicked. I'm proud of you for following your heart.", icon: "↗" });
    if (type === "mystery") openModal({ eyebrow: "OBJECT 004 / CASE STILL OPEN", title: "Still a mystery.", body: "The paperwork is pending. The investigators are confused. The doodle remains at large. Maybe we should leave it that way.", icon: "?" });
  }));
  $("#smileyButton").addEventListener("click", () => showWatcherMessage("You found the other smiley. This is becoming a pattern."));
  $("#normalButton").addEventListener("click", () => {
    showToast("I tried to act normal. Failed immediately.");
    document.body.classList.add("tiny-shake");
    window.setTimeout(() => document.body.classList.remove("tiny-shake"), 380);
  });
  $("#scribbleButton").addEventListener("click", () => {
    const card = $("#scribbleButton");
    card.classList.toggle("is-unscrambled");
    showToast(card.classList.contains("is-unscrambled") ? "It was a question mark the whole time. Incredible." : "Mystery restored. Nothing learned.");
  });
  $$("[data-toy]").forEach(button => button.addEventListener("click", () => {
    showToast(button.dataset.toy === "star" ? "You found the star. Congratulations, astronomer." : "You found a thing.");
    button.animate?.([{ transform: "rotate(0) scale(1)" }, { transform: "rotate(180deg) scale(1.3)" }, { transform: "rotate(360deg) scale(1)" }], { duration: 550, easing: "ease-out" });
  }));

  const questReplies = {
    people: ["PEOPLE WATCHING", "Meeting people is kind of like reading a book that changes its plot when you blink. I like that."],
    horror: ["BAD DECISIONS AFTER DARK", "The plan is to watch one episode. The reality is 3:17 AM and I am emotionally attached to a suspicious side character."],
    snacks: ["EMERGENCY SNACK PROTOCOL", "I was going to be productive, but then a snack happened. Case closed."],
    chaos: ["SMALL-SCALE MISCHIEF", "Some people collect stamps. I collect opportunities to be mildly annoying. We all need hobbies."]
  };
  $$("[data-quest]").forEach(button => button.addEventListener("click", () => {
    const reply = questReplies[button.dataset.quest];
    openModal({ eyebrow: "SIDE QUEST / OPTIONAL LORE", title: reply[0], body: reply[1], icon: "↗" });
  }));
  $("#finalNudge").addEventListener("click", () => {
    showToast("You clicked it. Your reward is this sentence. Thanks for visiting.");
    $(".final-star").animate?.([{ transform: "rotate(0) scale(1)" }, { transform: "rotate(180deg) scale(1.8)" }, { transform: "rotate(360deg) scale(1)" }], { duration: 650, easing: "ease-out" });
  });

  // Floating smiley: each response appears ABOVE the face, never on top of it.
  const fixedWatcher = $("#fixedWatcher");
  const watcherBubble = $("#watcherBubble");
  const watcherCaption = $("#watcherCaption");
  const watcherReplies = ["I think my little smile is watching you back.", "You can look. Just don't make it awkward."];
  function showWatcherMessage(message, duration = 3400) {
    watcherBubble.textContent = message;
    watcherBubble.classList.remove("is-hidden");
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => watcherBubble.classList.add("is-hidden"), duration);
  }
  function watcherLooksAway() {
    watcherIsAvoiding = true;
    fixedWatcher.classList.add("is-looking-away");
    fixedWatcher.classList.remove("is-looking-back");
    watcherCaption.textContent = "NOT LOOKING";
    window.clearInterval(watcherTimer);
    window.clearTimeout(watcherPeekTimer);
    watcherTimer = window.setInterval(() => {
      fixedWatcher.classList.add("is-looking-back");
      fixedWatcher.classList.remove("is-looking-away");
      watcherCaption.textContent = "JUST CHECKING";
      watcherPeekTimer = window.setTimeout(() => {
        fixedWatcher.classList.remove("is-looking-back");
        fixedWatcher.classList.add("is-looking-away");
        watcherCaption.textContent = "NOT LOOKING";
        if (watcherSilent) {
          watcherSilent = false;
          watcherClicks = 0;
          showWatcherMessage("...fine. You may speak to me again.", 2500);
        }
      }, 1700);
    }, 9000);
  }
  fixedWatcher.addEventListener("click", () => {
    if (watcherSilent) return;
    watcherClicks += 1;
    if (watcherClicks === 3) {
      fixedWatcher.classList.add("is-startled");
      showWatcherMessage("Stop it!!", 3000);
      window.setTimeout(() => fixedWatcher.classList.remove("is-startled"), 900);
    } else if (watcherClicks === 6) {
      showWatcherMessage("Okey, Okey, I won't look at you anymore.", 3800);
      watcherLooksAway();
    } else if (watcherClicks === 9) {
      showWatcherMessage("I won't talk to you anymore.", 3600);
      watcherSilent = true;
    } else if (watcherClicks < 3) {
      showWatcherMessage(watcherReplies[(watcherClicks - 1) % watcherReplies.length], 2800);
    } else if (watcherClicks < 6) {
      showWatcherMessage("I said I wasn't looking. I am practising.", 2500);
    }
  });
  document.addEventListener("pointermove", event => {
    if (watcherIsAvoiding && !fixedWatcher.classList.contains("is-looking-back")) return;
    const rect = fixedWatcher.getBoundingClientRect();
    const dx = Math.max(-3, Math.min(3, (event.clientX - (rect.left + rect.width / 2)) / 45));
    const dy = Math.max(-2, Math.min(2, (event.clientY - (rect.top + rect.height / 2)) / 55));
    fixedWatcher.style.setProperty("--look-x", `${dx}px`);
    fixedWatcher.style.setProperty("--look-y", `${dy}px`);
  }, { passive: true });
  window.setTimeout(() => showWatcherMessage("hi. don't make this weird.", 4500), 1500);

  // Right-click the poster question mark for a tiny context menu.
  const secretObject = $("#secretObject");
  const customContextMenu = $("#customContextMenu");
  let questionAnimationTimer = null;
  function animateQuestionMark() {
    secretObject.classList.remove("is-activating");
    // Restart the CSS keyframe so quick repeat clicks still get the full pop.
    void secretObject.offsetWidth;
    secretObject.classList.add("is-activating");
    window.clearTimeout(questionAnimationTimer);
    questionAnimationTimer = window.setTimeout(() => secretObject.classList.remove("is-activating"), 720);
  }
  function hideContextMenu() { customContextMenu.hidden = true; }
  secretObject.addEventListener("click", () => {
    animateQuestionMark();
    showToast("For a tiny secret menu, try right-clicking the question mark.");
  });
  secretObject.addEventListener("contextmenu", event => {
    event.preventDefault();
    animateQuestionMark();
    customContextMenu.hidden = false;
    const rect = customContextMenu.getBoundingClientRect();
    const margin = 10;
    customContextMenu.style.left = `${Math.max(margin, Math.min(event.clientX, window.innerWidth - rect.width - margin))}px`;
    customContextMenu.style.top = `${Math.max(margin, Math.min(event.clientY, window.innerHeight - rect.height - margin))}px`;
    customContextMenu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  });
  customContextMenu.addEventListener("click", event => {
    const item = event.target instanceof Element ? event.target.closest("[data-context-action]") : null;
    if (!item) return;
    const action = item.dataset.contextAction;
    hideContextMenu();
    if (action === "inspect") openModal({ eyebrow: "THE THING I HID / OBJECT Nº 403", title: "It's a question mark. Obviously.", body: "You right-clicked a decorative object. Honestly, I respect that level of curiosity.", icon: "?" });
    if (action === "leave") showToast("Good call. It was about to ask you something.");
  });
  document.addEventListener("pointerdown", event => {
    if (!customContextMenu.hidden && !customContextMenu.contains(event.target) && event.target !== secretObject) hideContextMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") hideContextMenu();
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !customContextMenu.hidden && customContextMenu.contains(document.activeElement)) {
      event.preventDefault();
      const items = $$('[role="menuitem"]', customContextMenu);
      const index = items.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  });
  window.addEventListener("resize", hideContextMenu);
  window.addEventListener("scroll", hideContextMenu, { passive: true });

  // Contact form: /api/message sends email on Vercel; otherwise offer a mailto fallback.
  const messageForm = $("#messageForm");
  const formStatus = $("#formStatus");
  const mailFallback = $("#mailFallback");
  const sendMessage = $("#sendMessage");
  messageForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(messageForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const honeypot = String(formData.get("website") || "").trim();
    if (honeypot) return;
    if (message.length < 2) {
      formStatus.dataset.kind = "error";
      formStatus.textContent = "Give me at least a couple of words to work with.";
      $("#messageText").focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formStatus.dataset.kind = "error";
      formStatus.textContent = "That email looks a little suspicious. Check it once?";
      $("#messageEmail").focus();
      return;
    }
    sendMessage.disabled = true;
    sendMessage.innerHTML = "Sending… <span aria-hidden=\"true\">↗</span>";
    formStatus.dataset.kind = "";
    formStatus.textContent = "Sending your note through the internet tubes…";
    mailFallback.hidden = true;
    try {
      const response = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website: honeypot })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The message service isn't ready yet.");
      formStatus.dataset.kind = "success";
      formStatus.textContent = "Message sent! It should reach my inbox. Thanks for dropping by ☺";
      messageForm.reset();
      showToast("Your message escaped successfully. Thank you.");
    } catch (error) {
      formStatus.dataset.kind = "error";
      formStatus.textContent = "The instant message service isn't connected yet. You can send the same note by email instead.";
      const subject = encodeURIComponent("A note from 403 degrees of Apon");
      const body = encodeURIComponent(`${message}\n\n— ${name || "A mystery person"}${email ? `\nReply to: ${email}` : ""}`);
      mailFallback.href = `mailto:403_error_4_u@proton.me?subject=${subject}&body=${body}`;
      mailFallback.hidden = false;
      console.warn("Message API unavailable:", error.message);
    } finally {
      sendMessage.disabled = false;
      sendMessage.innerHTML = 'Send it into the void <span aria-hidden="true">↗</span>';
    }
  });

  // Three clicks on the 403 badge reveal a silly full-screen error page.
  function activateTheme() {
    if (themeActive) return;
    themeActive = true;
    themeOverlay.classList.add("is-active");
    document.body.classList.add("theme-active");
    themeOverlay.setAttribute("aria-hidden", "false");
    $("#restoreTheme").focus({ preventScroll: true });
  }
  function restoreTheme() {
    themeActive = false;
    themeOverlay.classList.remove("is-active");
    document.body.classList.remove("theme-active");
    themeOverlay.setAttribute("aria-hidden", "true");
    secretClickCount = 0;
    $("#secret403").focus({ preventScroll: true });
  }
  $("#secret403").addEventListener("click", () => {
    secretClickCount += 1;
    window.clearTimeout(secretResetTimer);
    showToast(secretClickCount < 3 ? `You found the 403. ${3 - secretClickCount} more ${3 - secretClickCount === 1 ? "click" : "clicks"} for a secret.` : "Well, you asked for this. Don't blame me.");
    if (secretClickCount >= 3) { activateTheme(); secretClickCount = 0; }
    else secretResetTimer = window.setTimeout(() => { secretClickCount = 0; }, 5000);
  });
  $("#restoreTheme").addEventListener("click", restoreTheme);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && themeActive) restoreTheme(); });

  // Lift the floating watcher while the footer is on screen so the secret 403 stays clear.
  const siteFooter = document.querySelector(".site-footer");
  if (siteFooter && "IntersectionObserver" in window) {
    const footerObserver = new IntersectionObserver(entries => {
      document.body.classList.toggle("footer-in-view", entries.some(entry => entry.isIntersecting));
    }, { threshold: 0.08 });
    footerObserver.observe(siteFooter);
  }

  // Type APON anywhere outside a form to trigger a tiny brand celebration.
  document.addEventListener("keydown", event => {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (typing || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || !/[a-z]/i.test(event.key)) return;
    typedBuffer = (typedBuffer + event.key.toLowerCase()).slice(-4);
    if (typedBuffer === "apon") {
      typedBuffer = "";
      document.body.classList.remove("egg-celebration");
      void document.body.offsetWidth;
      document.body.classList.add("egg-celebration");
      window.setTimeout(() => document.body.classList.remove("egg-celebration"), 2200);
      showToast("APON DETECTED. You know too much about me now.");
    }
  });

  try {
    const key = "degreesOfAponVisits";
    const visits = Number.parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, String(Number.isFinite(visits) ? visits : 1));
    if (visits > 1) window.setTimeout(() => showToast("Oh, you're back. I knew this place had potential."), 2300);
  } catch (_) { /* Storage can be blocked; the page still works. */ }
  window.addEventListener("pagehide", () => {
    window.clearInterval(watcherTimer);
    window.clearTimeout(watcherPeekTimer);
    window.clearTimeout(bubbleTimer);
    window.clearTimeout(secretResetTimer);
  });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) $$(".ticker-track").forEach(track => { track.style.animation = "none"; });
})();
