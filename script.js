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

  // Count one visit per page load so the little welcome messages progress predictably.
  let visitNumber = 1;
  try {
    const visitKey = "degreesOfAponMessageVisits";
    const previousVisits = Number.parseInt(localStorage.getItem(visitKey) || "0", 10);
    visitNumber = Number.isFinite(previousVisits) && previousVisits >= 0 ? previousVisits + 1 : 1;
    localStorage.setItem(visitKey, String(visitNumber));
  } catch (_) { /* Storage can be blocked; the page still works. */ }

  const statuses = [
    ["Curiosity detected!!", "Go on, make questionable decisions,,"],
    ["Suspicious activity!!", "You’re clicking things again, aren’t you?"],
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

  function openModal({ title, body, eyebrow = "A LITTLE INTERRUPTION FROM ME", icon = "✳", link = null, buttonLabel = "Fair Enough", hideOkay = false }) {
    modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalTitle.textContent = title;
    modalBody.textContent = body;
    const previousExtraLink = $("#modalExtraLink");
    if (previousExtraLink) previousExtraLink.remove();
    if (link && link.href && link.label) {
      const extraLink = document.createElement("a");
      extraLink.id = "modalExtraLink";
      extraLink.className = "modal-extra-link";
      extraLink.href = link.href;
      extraLink.textContent = link.label;
      extraLink.target = "_blank";
      extraLink.rel = "noopener noreferrer";
      modalBody.insertAdjacentElement("afterend", extraLink);
    }
    modalEyebrow.textContent = eyebrow;
    modalIcon.textContent = icon;
    const modalOkay = $("#modalOkay");
    modalOkay.hidden = hideOkay;
    modalOkay.innerHTML = `${buttonLabel} <span>↗</span>`;
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

  const aboutCopy = "DU criminology student. Curious about people. Frequently hungry. Enjoys horror, silly ideas, and clicking things that say 'do not click.' Please investigate responsibly.";
  function showAbout() {
    openModal({ eyebrow: "A LITTLE ABOUT ME / FILE Nº 403", title: "So, you want to know who I am?", body: aboutCopy, icon: "⌕" });
  }
  $("#aboutButton").addEventListener("click", showAbout);

  // The Mystic moon has one tiny message for curious visitors.
  const mysticMoon = $("#mysticMoon");
  if (mysticMoon) {
    const openMoonMessage = () => openModal({
      eyebrow: "A MESSAGE FROM THE MOON",
      title: "A tiny secret",
      body: "You know... The sky is blue.\nBut you don't know the meaning it holds... to me.",
      icon: "☾",
      hideOkay: true
    });
    mysticMoon.setAttribute("role", "button");
    mysticMoon.setAttribute("tabindex", "0");
    mysticMoon.setAttribute("aria-label", "Open the moon's message");
    mysticMoon.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMoonMessage();
      }
    });

    // The moon sits behind the page, so the browser reports the element beneath
    // it as the tap target. Track a tap in the moon's circle and open the message
    // unless the visitor was interacting with a real control or draggable surface.
    // Do not exclude ordinary text/containers: those were swallowing the moon tap
    // on mobile because the moon's circle overlaps the hero text at narrow widths.
    const foregroundMoonExclusions = [
      "a", "button", "input", "textarea", "select", "summary", "label",
      "[role='button']", "[role='link']", "[role='menuitem']", "[role='dialog']",
      "[contenteditable='true']", "[data-highlight]",
      ".fixed-watcher", ".custom-context-menu", ".tiny-object", ".social-float",
      ".oddity-card", ".shelf-tile", ".interest-note", ".interest-sticker",
      ".sidequest-row", ".message-form"
    ].join(",");
    const pointIsOnMoon = (x, y) => {
      const rect = mysticMoon.getBoundingClientRect();
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
      const dx = (x - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = (y - (rect.top + rect.height / 2)) / (rect.height / 2);
      return dx * dx + dy * dy <= 1;
    };
    // Use click rather than pointerup: mobile browsers synthesize click after pointerup,
    // and opening a modal during pointerup can make that same tap land on its backdrop
    // and close the modal immediately.
    document.addEventListener("click", event => {
      if (!document.body.classList.contains("mystic-mode") || !pointIsOnMoon(event.clientX, event.clientY)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && target.closest(foregroundMoonExclusions)) return;
      openMoonMessage();
    }, true);
  }

  // Marker mode is deliberately interactive: hover, tap, or select the bits you like.
  function setMarkerMode(active) {
    document.body.classList.toggle("highlight-mode", active);
    markerToggle.setAttribute("aria-pressed", String(active));
    markerState.textContent = active ? "on" : "off";
    if (active) {
      showToast("Yes, words are better with a little drama.", 2300);
      // Emphasize just “drama” without injecting HTML into the toast.
      const toast = toastRegion.lastElementChild;
      if (toast) {
        toast.replaceChildren(document.createTextNode("Yes, words are better with a little "));
        const emphasis = document.createElement("strong");
        emphasis.textContent = "drama";
        toast.append(emphasis, document.createTextNode("."));
      }
    }
  }
  markerToggle.addEventListener("click", () => setMarkerMode(markerToggle.getAttribute("aria-pressed") !== "true"));
  const labToggle = $("#labToggle");
  if (labToggle) labToggle.addEventListener("click", () => setMarkerMode(markerToggle.getAttribute("aria-pressed") !== "true"));
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
    showToast("You clicked it,, your reward is this sentence!! Thanks for visiting.");
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
  if (visitNumber <= 2) window.setTimeout(() => showWatcherMessage("hi, don't make this weird,,", 4500), 1500);

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
    showToast("For a tiny secret menu, try right-clicking the question mark,,");
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
    if (action === "inspect") openModal({ eyebrow: "THE THING I HID / OBJECT Nº 403", title: "Why 403 is everywhere??", body: "Because It means 'Access Forbidden' — the server got your request but won't let you in,, hehe :) You right-clicked a decorative object. Honestly, I respect that level of curiosity.", icon: "?" });
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


  // My little obsessions: each scrapbook note opens its own tiny lore window.
  const interestLore = {
    music: { eyebrow: "SIDE QUEST / SOUNDTRACK", title: "Music is the loading screen of my brain.", body: "Want a shortcut to my music taste? Have a look at one of my Spotify playlists. Judge gently; I have feelings.", icon: "♫", hideOkay: true, link: { href: "https://open.spotify.com/playlist/6tFOCvL6DThpPn9BTPYJXC?si=nD88JczOSnC_kvL7LWO2hw", label: "Listen to my playlist on Spotify ↗" } },
    science: { buttonLabel: "Fair point", eyebrow: "SIDE QUEST / CURIOSITY LAB", title: "I need to know why that happens.", body: "Science is just asking 'but why?' until someone brings out a diagram. I support this lifestyle. Bonus points if the explanation makes me ask five more questions.", icon: "⚗", hideOkay: true },
    computers: { buttonLabel: "Fair point", eyebrow: "SIDE QUEST / COMPUTER NOISES", title: "A tiny machine, a million rabbit holes.", body: "Hardware, software, weird internet corners, and the eternal confidence of clicking a setting I don't fully understand. What could possibly go wrong?", icon: "⌘", hideOkay: true },
    chess: { buttonLabel: "Fair point", eyebrow: "SIDE QUEST / BOARD-BASED HUMBLING", title: "My opponent was the blunder I made along the way.", body: "Chess: where I confidently plan six moves ahead and immediately forget the knight exists. Still, one more game. Obviously.", icon: "♞", hideOkay: true },
    sweets: { eyebrow: "SIDE QUEST / SNACK EMERGENCY", title: "This could have been an email. I brought sweets.", body: "Dessert is not a reward. It is a perfectly reasonable part of the schedule. Please direct all further questions to the nearest pastry.", icon: "🍬", hideOkay: true },
    photography: { eyebrow: "SIDE QUEST / FREEZE FRAME", title: "Wait. The light is doing a thing.", body: "I like catching little details before they disappear: odd corners, nice light, forgotten objects, and things everyone else walked past. Sometimes the camera roll is 80% 'maybe this will look cool'.", icon: "▧", hideOkay: true },
    books: { eyebrow: "SIDE QUEST / PAPER PORTAL", title: "I can stop after this chapter.", body: "A sentence I have never once meant. Books are tiny portals, and I keep walking into them without checking what time it is.", icon: "▤", hideOkay: true },
    tv: { eyebrow: "SIDE QUEST / ONE MORE EPISODE", title: "The credits are not a stopping point.", body: "I can appreciate a good story, a suspicious character, and a finale that leaves me staring at the wall. Sleep schedule? Never heard of her.", icon: "▣", hideOkay: true },
    repair: { eyebrow: "SIDE QUEST / SECOND CHANCES", title: "Broken doesn't always mean finished.", body: "Old gadgets, abandoned things, wobbly objects: sometimes they need a fix, sometimes a clean-up, sometimes a new purpose. Repair and reuse feels better than throwing everything away. Also, taking things apart is educational. Usually.", icon: "⚒", hideOkay: true },
    useless: { buttonLabel: "Fair point", eyebrow: "SIDE QUEST / COMPLETELY UNNECESSARY KNOWLEDGE", title: "I learned this for absolutely no reason.", body: "Fun facts, obscure skills, strange histories, and tutorials I will probably never need. Is it useful? No. Could I explain it for twelve minutes? Unfortunately, yes.", icon: "✳", hideOkay: true }
  };
  $$("[data-interest]").forEach(note => note.addEventListener("click", () => {
    const entry = interestLore[note.dataset.interest];
    if (entry) openModal(entry);
  }));

  // The Shelf: three seamless copies. The visible row always has another
  // identical set waiting beyond the edge, so the wrap never flashes at center.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$(".shelf-row").forEach(row => {
    const track = $(".shelf-track", row);
    if (!track || !track.children.length) return;

    const originals = [...track.children];
    originals.forEach(node => {
      node.dataset.originalTile = "true";
    });
    // Keep two matching copies after the original: at the loop point, the
    // next identical set is already visible, so there is no empty end.
    for (let copy = 0; copy < 2; copy++) {
      originals.forEach(node => {
        const clone = node.cloneNode(true);
        clone.removeAttribute("id");
        clone.setAttribute("aria-hidden", "true");
        clone.dataset.shelfClone = "true";
        if (clone.matches("button, a, [tabindex]")) clone.tabIndex = -1;
        track.appendChild(clone);
      });
    }

    const direction = parseInt(row.dataset.dir || "-1", 10) < 0 ? 1 : -1;
    const speed = Math.max(.15, parseFloat(row.dataset.speed || ".38") || .38) * direction;
    let offset = 0, velocity = 0, dragging = false, lastX = 0, inView = true;
    let paused = false;
    let cycleWidth = 0;
    let raf = 0;

    function measureCycle() {
      const firstCopyStart = track.children[originals.length];
      cycleWidth = firstCopyStart
        ? Math.max(1, firstCopyStart.offsetLeft - track.children[0].offsetLeft)
        : Math.max(1, track.scrollWidth / 3);
      // Start in the middle copy, with a complete identical copy on either side.
      offset = cycleWidth + (offset % cycleWidth);
      track.style.transform = `translate3d(${-offset}px,0,0)`;
    }
    measureCycle();
    window.addEventListener("resize", measureCycle, { passive: true });

    function normalizeOffset() {
      if (cycleWidth <= 1) return;
      // Wrap at the copy boundary while the following copy is already in view.
      while (offset >= cycleWidth * 2) offset -= cycleWidth;
      while (offset < cycleWidth) offset += cycleWidth;
    }

    function frame() {
      if (!dragging) {
        if (!paused && !reduceMotion && inView) offset += speed;
        offset += velocity;
        velocity *= .93;
        normalizeOffset();
        track.style.transform = `translate3d(${-offset}px,0,0)`;
      }
      raf = window.requestAnimationFrame(frame);
    }
    raf = window.requestAnimationFrame(frame);

    row.addEventListener("pointerenter", () => { paused = true; });
    row.addEventListener("pointerleave", () => { paused = false; });
    row.addEventListener("focusin", () => { paused = true; });
    row.addEventListener("focusout", () => { paused = false; });
    row.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true; lastX = event.clientX; velocity = 0;
      row.dataset.moved = "";
      try { row.setPointerCapture(event.pointerId); } catch (_) {}
    });
    row.addEventListener("pointermove", event => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      offset -= dx;
      velocity = -dx;
      if (Math.abs(dx) > 3) row.dataset.moved = "1";
      normalizeOffset();
      track.style.transform = `translate3d(${-offset}px,0,0)`;
    });
    const endDrag = () => { dragging = false; };
    row.addEventListener("pointerup", endDrag);
    row.addEventListener("pointercancel", endDrag);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); }, { threshold: 0.02 }).observe(row);
    }
  });

  // Shelf tiles open a tiny review file — unless the user was just dragging.
  $$(".shelf-tile:not([data-shelf-clone])").forEach(tileEl => {
    tileEl.addEventListener("click", () => {
      const row = tileEl.closest(".shelf-row");
      if (row && row.dataset.moved) { delete row.dataset.moved; return; }
      openModal({
        eyebrow: `THE SHELF / ${(tileEl.dataset.tag || "UNFILED").toUpperCase()}`,
        title: tileEl.dataset.title || "Untitled masterpiece",
        body: tileEl.dataset.review || "No notes. Suspicious.",
        icon: tileEl.dataset.icon || "✳"
      });
    });
  });

  

  
  // The tiny ghost attacks once per page load, but only after the visitor has passed the useful-thought section.
  const ghostJumpscare = $("#ghostJumpscare");
  if (ghostJumpscare) {
    let ghostAttackPlayed = false;
    let ghostAttackScheduled = false;
    let ghostRetryTimer = 0;
    let ghostFallbackTimer = 0;
    let ghostDelayTimer = 0;
    let usefulSectionPassed = false;
    let targetSectionSeen = false;
    let fallbackReady = false;
    let ghostSectionObserver = null;

    const usefulSection = $("#little-world");
    const hasPassedUsefulSection = () => {
      if (!usefulSection) return true;
      const sectionBottom = usefulSection.getBoundingClientRect().bottom + window.scrollY;
      return window.scrollY >= sectionBottom - Math.min(55, usefulSection.offsetHeight * 0.12);
    };
    usefulSectionPassed = hasPassedUsefulSection();

    // A random target is selected only from sections following the "You could be doing something useful" section.
    const targetSections = usefulSection
      ? $$("#main > section").filter(section =>
          section !== usefulSection &&
          Boolean(usefulSection.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          section.matches(".manifesto, #oddities, #shelf, #interests, #sidequests, #message, .final-note")
        )
      : $$("#main > section").filter(section => section.matches("#oddities, #shelf, #interests, #sidequests, #message, .final-note"));
    const targetSection = targetSections.length
      ? targetSections[Math.floor(Math.random() * targetSections.length)]
      : null;

    const playGhostAttack = (sectionAnchor = null) => {
      if (ghostAttackPlayed || !usefulSectionPassed) return;
      // Never cover a dialog or the restricted-area overlay; try again when the moment is clear.
      if (modal.open || themeOverlay.classList.contains("is-active")) {
        if (!ghostRetryTimer) {
          ghostRetryTimer = window.setTimeout(() => {
            ghostRetryTimer = 0;
            playGhostAttack(sectionAnchor);
          }, 800);
        }
        return;
      }

      ghostAttackPlayed = true;
      ghostAttackScheduled = false;
      if (ghostFallbackTimer) window.clearTimeout(ghostFallbackTimer);
      // Prefer a random visible point within the randomly selected section; fallback to a viewport spot.
      const isSmallScreen = window.matchMedia("(max-width: 520px)").matches;
      let x = isSmallScreen ? 44 + Math.random() * 12 : 29 + Math.random() * 42;
      let y = 34 + Math.random() * 15;
      if (sectionAnchor) {
        const rect = sectionAnchor.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        const visibleLeft = Math.max(0, rect.left);
        const visibleRight = Math.min(window.innerWidth, rect.right);
        if (visibleBottom - visibleTop > 60 && visibleRight - visibleLeft > 80) {
          const pointX = visibleLeft + (visibleRight - visibleLeft) * (0.32 + Math.random() * 0.36);
          const pointY = visibleTop + (visibleBottom - visibleTop) * (0.34 + Math.random() * 0.32);
          x = isSmallScreen ? 44 + Math.random() * 12 : Math.min(70, Math.max(30, pointX / window.innerWidth * 100));
          y = Math.min(56, Math.max(30, pointY / window.innerHeight * 100));
        }
      }
      ghostJumpscare.style.setProperty("--ghost-x", `${x.toFixed(1)}%`);
      ghostJumpscare.style.setProperty("--ghost-y", `${y.toFixed(1)}%`);
      ghostJumpscare.hidden = false;
      ghostJumpscare.classList.remove("is-active");
      void ghostJumpscare.offsetWidth;
      ghostJumpscare.classList.add("is-active");

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        window.setTimeout(() => {
          if (ghostAttackPlayed && !ghostJumpscare.hidden) {
            document.body.classList.remove("ghost-shaking");
            void document.body.offsetWidth;
            document.body.classList.add("ghost-shaking");
            window.setTimeout(() => document.body.classList.remove("ghost-shaking"), 420);
          }
        }, 650);
      }

      window.setTimeout(() => {
        ghostJumpscare.classList.remove("is-active");
        ghostJumpscare.hidden = true;
        document.body.classList.remove("ghost-shaking");
      }, reducedMotion ? 1050 : 3500);
    };

    const scheduleGhostAttack = (sectionAnchor = null) => {
      if (ghostAttackPlayed || ghostAttackScheduled || !usefulSectionPassed) return;
      ghostAttackScheduled = true;
      if (ghostFallbackTimer) window.clearTimeout(ghostFallbackTimer);
      // Let the visitor get past the useful section before the surprise lands.
      ghostDelayTimer = window.setTimeout(() => {
        ghostAttackScheduled = false;
        playGhostAttack(sectionAnchor);
      }, 450 + Math.random() * 1650);
    };

    const handleUsefulSectionPass = () => {
      if (!usefulSectionPassed && hasPassedUsefulSection()) {
        usefulSectionPassed = true;
        if (fallbackReady) scheduleGhostAttack();
        else if (targetSectionSeen) scheduleGhostAttack(targetSection);
      }
    };
    window.addEventListener("scroll", handleUsefulSectionPass, { passive: true });
    window.addEventListener("resize", handleUsefulSectionPass, { passive: true });

    if (targetSection && "IntersectionObserver" in window) {
      ghostSectionObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          targetSectionSeen = true;
          ghostSectionObserver.disconnect();
          if (usefulSectionPassed) scheduleGhostAttack(targetSection);
        }
      }, { threshold: 0.18 });
      ghostSectionObserver.observe(targetSection);
    }

    // Eight seconds longer than before. If the visitor has not passed the useful section yet,
    // the fallback waits until they do rather than firing early.
    ghostFallbackTimer = window.setTimeout(() => {
      fallbackReady = true;
      if (!ghostAttackScheduled && !ghostAttackPlayed && usefulSectionPassed) scheduleGhostAttack();
    }, 14500 + Math.random() * 2500);

    window.addEventListener("pagehide", () => {
      window.clearTimeout(ghostRetryTimer);
      window.clearTimeout(ghostFallbackTimer);
      window.clearTimeout(ghostDelayTimer);
      if (ghostSectionObserver) ghostSectionObserver.disconnect();
      window.removeEventListener("scroll", handleUsefulSectionPass);
      window.removeEventListener("resize", handleUsefulSectionPass);
    }, { once: true });
  }

  // Scroll progress hairline up top.
  const progressBar = $("#scrollProgress");
  const paintProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  window.addEventListener("scroll", paintProgress, { passive: true });
  window.addEventListener("resize", paintProgress);
  paintProgress();

  // The footer quietly reports live status updates from Apon.exe.
  const footerStatus = $("#footerStatus");
  if (footerStatus && statuses.length) {
    let statusIndex = 0;
    window.setInterval(() => {
      statusIndex = (statusIndex + 1) % statuses.length;
      footerStatus.classList.add("is-swapping");
      window.setTimeout(() => {
        footerStatus.textContent = `STATUS: ${statuses[statusIndex][0]} ${statuses[statusIndex][1]}`;
        footerStatus.classList.remove("is-swapping");
      }, 230);
    }, 8000);
  }

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
  // Typing 403 anywhere also opens the restricted area. Consistency.
  let secretKeyBuffer = "";
  document.addEventListener("keydown", event => {
    const targetEl = event.target;
    const isTyping = targetEl instanceof HTMLElement && (targetEl.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(targetEl.tagName));
    if (isTyping || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    secretKeyBuffer = (secretKeyBuffer + event.key).slice(-3);
    if (secretKeyBuffer === "403") { secretKeyBuffer = ""; activateTheme(); }
  });


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
      showToast("APON DETECTED!! You know too much about me now,,");
    }
  });

  if (visitNumber === 3) {
    window.setTimeout(() => showToast("Oh, you are back, I knew this place had potential", 3600), 2300);
  } else if (visitNumber >= 4 && visitNumber <= 7) {
    window.setTimeout(() => showToast("You are back again!!", 3200), 2300);
  } else if (visitNumber === 8) {
    window.setTimeout(() => showToast("Wow, I think you are addicted to my site!!", 3600), 2300);
  }
  window.addEventListener("pagehide", () => {
    window.clearInterval(watcherTimer);
    window.clearTimeout(watcherPeekTimer);
    window.clearTimeout(bubbleTimer);
    window.clearTimeout(secretResetTimer);
  });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) $$(".ticker-track").forEach(track => { track.style.animation = "none"; });

  // Living side-wall knowledge graph: soft, same-ink particles that thin toward the center.
  (() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canvas = document.createElement("canvas");
    canvas.className = "knowledge-web-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) { canvas.remove(); return; }

    let width = 0, height = 0, dpr = 1, raf = 0, lastSpawn = 0;
    let nextId = 1, tapCount = 0;
    const particles = [];
    const bursts = [];
    const ink = "#1e211b"; // Match the graph-paper grid and the page's ink.
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const random = (min, max) => min + Math.random() * (max - min);
    const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    // Stable per-edge variation keeps line weights organic without flickering frame to frame.
    const edgeWidth = (a, b, base = 1.55, spread = 0.72) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const seed = Math.abs(Math.sin(lo * 12.9898 + hi * 78.233) * 43758.5453) % 1;
      return base + seed * spread;
    };
    const isMobile = () => width < 650;
    const maxParticles = () => width < 480 ? 60 : width < 760 ? 78 : width < 1200 ? 112 : 136;
    const spawnInterval = () => isMobile() ? 390 : 270;
    // Let the graph reach a little farther toward the center, but keep both halves separate.
    const bandWidth = () => width * (width < 650 ? 0.30 : width < 1100 ? 0.27 : 0.245);

    function variedRadius() {
      // Restore the original expressive range of dot sizes so the network reads at a glance.
      const roll = Math.random();
      if (roll < 0.17) return random(1.1, 2.0);
      if (roll < 0.37) return random(2.0, 3.2);
      if (roll < 0.59) return random(3.2, 4.9);
      if (roll < 0.77) return random(4.9, 7.1);
      if (roll < 0.91) return random(7.1, 9.8);
      if (roll < 0.975) return random(9.8, 12.2);
      return random(12.2, 14);
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const band = bandWidth();
      particles.forEach(p => {
        p.tx = p.side < 0 ? clamp(p.tx, 1, band) : clamp(p.tx, width - band, width - 1);
        p.x = clamp(p.x, 0, width);
        p.y = clamp(p.y, -10, height + 10);
      });
      if (particles.length > maxParticles()) particles.splice(0, particles.length - maxParticles());
      draw(performance.now());
    }

    function spawnParticle(now) {
      if (particles.length >= maxParticles()) return;
      const side = isMobile() ? 1 : (Math.random() < 0.5 ? -1 : 1);
      const band = bandWidth();
      // Squared distance puts more arrivals at the wall, with a natural long tail inward.
      const distance = Math.pow(Math.random(), 1.72) * band;
      const startX = side < 0 ? 0.5 : width - 0.5;
      const targetX = side < 0 ? Math.max(1, distance) : Math.min(width - 1, width - distance);
      const y = random(0, height);
      const radius = variedRadius();
      const life = random(20500, 31500);
      const wallDistance = distance / Math.max(1, band);
      particles.push({
        id: nextId++, side,
        sx: startX, sy: y, tx: targetX,
        ty: clamp(y + random(-75, 75), -8, height + 8),
        x: startX, y,
        born: now, life, travel: random(3300, 5200), radius,
        phase: random(0, Math.PI * 2), drift: random(2.2, 10.5),
        wallLink: Math.random() < 0.52,
        // Bigger dots are intentionally softer; farther-in dots are also fainter.
        sizeOpacity: clamp(0.68 - Math.pow(radius / 14, 1.3) * 0.42, 0.13, 0.66),
        wallDistance,
        alpha: random(0.44, 0.76),
        xDrift: random(2.5, 9)
      });
    }

    function addTapWave(x, y, allowRepeat = false) {
      if (tapCount >= 5 && !allowRepeat) return;
      if (tapCount < 5) tapCount++;
      const now = performance.now();
      const band = bandWidth();
      const wave = { born: now, x, y, ink, nodes: [] };
      const perSide = isMobile() ? 5 : 7;
      for (const side of (isMobile() ? [1] : [-1, 1])) {
        for (let i = 0; i < perSide; i++) {
          // Clusters reach the walls, but do so in a slow, graceful outward glide.
          const distance = Math.pow(Math.random(), 1.78) * band;
          const targetX = side < 0 ? Math.max(1, distance) : Math.min(width - 1, width - distance);
          const travel = random(2850, 4100);
          const radius = variedRadius();
          wave.nodes.push({
            id: nextId++, sx: x, sy: y, tx: targetX,
            ty: clamp(y + random(-Math.min(height * 0.4, 280), Math.min(height * 0.4, 280)), 18, Math.max(18, height - 18)),
            side, radius, phase: random(0, Math.PI * 2),
            delay: random(0, 420), travel,
            sizeOpacity: clamp(0.66 - Math.pow(radius / 14, 1.3) * 0.40, 0.13, 0.64)
          });
        }
      }
      bursts.push(wave);
      if (!raf) raf = requestAnimationFrame(animate);
    }

    function getPoint(p, now) {
      const age = now - p.born;
      const progress = easeInOut(clamp(age / p.travel, 0, 1));
      const moving = reducedMotion.matches ? 0 : 1;
      const driftY = moving * Math.sin(now * 0.00032 + p.phase) * p.drift;
      const driftX = moving * Math.sin(now * 0.00024 + p.phase * 1.7) * p.xDrift;
      // Smoothly fade the graph toward its inner edge, leaving the page center uncluttered.
      const innerFade = 0.16 + 0.84 * Math.pow(1 - p.wallDistance, 1.28);
      let alpha = clamp(age / 1450, 0, 1);
      const fadeStart = p.life - 5200;
      if (age > fadeStart) alpha *= clamp((p.life - age) / 5200, 0, 1);
      const breathe = reducedMotion.matches ? 0.95 : 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(now * 0.00072 + p.phase));
      const pulse = reducedMotion.matches ? 1 : 0.82 + 0.24 * (0.5 + 0.5 * Math.sin(now * 0.0008 + p.phase));
      const radius = Math.min(14, p.radius * pulse);
      return {
        x: p.sx + (p.tx - p.sx) * progress + driftX,
        y: p.sy + (p.ty - p.sy) * progress + driftY,
        radius,
        alpha: alpha * innerFade * Math.min(1, p.sizeOpacity * 1.3) * Math.min(1, p.alpha * 1.2) * breathe,
        side: p.side, wallLink: p.wallLink, phase: p.phase, id: p.id,
        wallDistance: p.wallDistance
      };
    }

    function draw(now) {
      if (!ctx || !width || !height) return;
      ctx.clearRect(0, 0, width, height);
      const band = bandWidth();
      const visible = particles.map(p => ({ source: p, point: getPoint(p, now) }));
      const groups = [visible.filter(item => item.point.side < 0), visible.filter(item => item.point.side > 0)];
      const maxLink = isMobile() ? 74 : 108;

      // Join nearby dots with one consistent ink color; connections thin inward with the nodes.
      for (const group of groups) {
        const drawn = new Set();
        for (const item of group) {
          const a = item.point;
          if (a.alpha < 0.018) continue;
          const neighbors = group
            .filter(other => other.source.id !== item.source.id)
            .map(other => ({ point: other.point, d: Math.hypot(other.point.x - a.x, other.point.y - a.y) }))
            .filter(other => other.d < maxLink)
            .sort((u, v) => u.d - v.d)
            .slice(0, 3);
          for (const neighbor of neighbors) {
            const key = a.id < neighbor.point.id ? `${a.id}:${neighbor.point.id}` : `${neighbor.point.id}:${a.id}`;
            if (drawn.has(key)) continue;
            drawn.add(key);
            const closeness = 1 - neighbor.d / maxLink;
            const edgeFade = Math.min(a.alpha, neighbor.point.alpha);
            ctx.strokeStyle = ink;
            ctx.lineWidth = edgeWidth(a.id, neighbor.point.id, 1.55, 0.72) + closeness * 0.16;
            ctx.globalAlpha = edgeFade * (0.28 + closeness * 0.34);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(neighbor.point.x, neighbor.point.y);
            ctx.stroke();
          }
        }
      }

      document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey &&
          ["i", "j", "c"].includes(key))
        ) {
        event.preventDefault();
        }
      });
      // Random, delicate tethers visually fasten part of each network to the wall itself.
      for (const item of visible) {
        const p = item.point;
        if (!p.wallLink || p.alpha < 0.035) continue;
        const distance = p.side < 0 ? p.x : width - p.x;
        if (distance > band * 0.76) continue;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.3 + (Math.abs(Math.sin(p.id * 14.217) * 43758.5453) % 1) * 0.8;
        ctx.globalAlpha = p.alpha * 0.24 * (1 - distance / band);
        ctx.beginPath();
        ctx.moveTo(p.side < 0 ? 0 : width, p.y - Math.sin(p.phase) * 6);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // Discourage casual inspection via the right-click menu
      document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

      // The whole size range uses a single ink; large points bloom softly and fade more.
      for (const item of visible) {
        const p = item.point;
        if (p.alpha < 0.01) continue;
        if (p.radius > 3.0) {
          const glow = ctx.createRadialGradient(p.x, p.y, p.radius * 0.12, p.x, p.y, p.radius * 1.8);
          glow.addColorStop(0, "rgba(30,33,27,0.24)");
          glow.addColorStop(1, "rgba(30,33,27,0)");
          ctx.fillStyle = glow;
          ctx.globalAlpha = p.alpha * 0.28;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = ink;
        ctx.globalAlpha = p.alpha * 0.96;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.65, p.radius), 0, Math.PI * 2);
        ctx.fill();
      }

      // Five eligible taps create slow, temporary graphs that spread all the way to the walls.
      for (let w = bursts.length - 1; w >= 0; w--) {
        const wave = bursts[w];
        const age = now - wave.born;
        const points = wave.nodes.map((node, i) => {
          const localAge = Math.max(0, age - node.delay);
          const t = easeInOut(clamp(localAge / node.travel, 0, 1));
          const drifting = reducedMotion.matches ? 0 : Math.sin(now * 0.00038 + node.phase) * 5;
          // Stay near the wall for a beat, then dissolve gently rather than snapping away.
          const arrivedAt = node.delay + node.travel;
          const dissolve = clamp((age - arrivedAt - 850) / 2100, 0, 1);
          const alpha = clamp(localAge / 850, 0, 1) * (1 - easeOut(dissolve));
          return {
            x: node.sx + (node.tx - node.sx) * t + (t > 0.99 ? drifting : 0),
            y: node.sy + (node.ty - node.sy) * t + (t > 0.99 ? drifting * 0.65 : 0),
            radius: Math.min(14, node.radius * (reducedMotion.matches ? 1 : 0.91 + 0.09 * Math.sin(now * 0.00075 + node.phase))),
            alpha: alpha * node.sizeOpacity * (0.9 - 0.45 * Math.pow(node.radius / 14, 1.2)),
            id: node.id, side: node.side, phase: node.phase
          };
        });

        // Connect same-side tap nodes only, so these transient graphs never form a line across center.
        for (const side of [-1, 1]) {
          const sidePoints = points.filter(p => p.side === side && p.alpha > 0.025);
          for (let i = 0; i < sidePoints.length; i++) {
            const a = sidePoints[i];
            const nearest = sidePoints.slice(i + 1)
              .map(b => ({ b, d: Math.hypot(b.x - a.x, b.y - a.y) }))
              .filter(pair => pair.d < 105)
              .sort((u, v) => u.d - v.d)
              .slice(0, 2);
            nearest.forEach(({ b, d }) => {
              ctx.strokeStyle = ink;
              ctx.lineWidth = 0.75;
              ctx.globalAlpha = Math.min(a.alpha, b.alpha) * (0.18 + (1 - d / 105) * 0.22);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            });
          }
        }
        points.forEach(p => {
          if (p.alpha <= 0.012) return;
          ctx.fillStyle = ink;
          ctx.globalAlpha = p.alpha * 0.96;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        const latestArrival = Math.max(...wave.nodes.map(node => node.delay + node.travel));
        if (age > latestArrival + 3100) bursts.splice(w, 1);
      }
      ctx.globalAlpha = 1;
    }

    function animate(now) {
      raf = 0;
      if (document.hidden) return;
      // Slower arrivals create a calmer field; expired dots make room for random new ones.
      if (now - lastSpawn >= spawnInterval() && particles.length < maxParticles()) {
        spawnParticle(now);
        lastSpawn = now;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        if (now - particles[i].born >= particles[i].life) particles.splice(i, 1);
      }
      draw(now);
      raf = requestAnimationFrame(animate);
    }

    let pendingPointer = null;
    let lastPostFiveTap = null;
    const isExcludedTapTarget = target => target instanceof Element && !!target.closest(
      ".theme-overlay, .mystic-moon-wrap, input, textarea, select, a, button, [role='dialog'], [contenteditable='true']"
    );

    document.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.isPrimary === false || !event.isTrusted) return;
      if (!(event.target instanceof Element) || isExcludedTapTarget(event.target)) return;
      pendingPointer = {
        id: event.pointerId,
        target: event.target,
        x: event.clientX,
        y: event.clientY,
        pageX: window.scrollX,
        pageY: window.scrollY,
        at: performance.now(),
        moved: false,
        scrolled: false
      };
    }, { passive: true });

    document.addEventListener("pointermove", event => {
      if (!pendingPointer || event.pointerId !== pendingPointer.id) return;
      if (Math.hypot(event.clientX - pendingPointer.x, event.clientY - pendingPointer.y) > 11) {
        pendingPointer.moved = true;
      }
    }, { passive: true });

    document.addEventListener("pointerup", event => {
      const press = pendingPointer;
      if (!press || event.pointerId !== press.id) return;
      pendingPointer = null;
      const moved = press.moved || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 11;
      const scrolled = press.scrolled || window.scrollX !== press.pageX || window.scrollY !== press.pageY;
      const quickEnough = performance.now() - press.at <= 700;
      const endTarget = document.elementFromPoint(event.clientX, event.clientY);
      if (moved || scrolled || !quickEnough || !(endTarget instanceof Element) || isExcludedTapTarget(endTarget)) return;

      const now = performance.now();
      if (tapCount < 5) {
        addTapWave(event.clientX, event.clientY);
        return;
      }
      // Once the initial five waves are used, require a genuine double tap to spawn another.
      if (lastPostFiveTap && now - lastPostFiveTap.at <= 420 &&
          Math.hypot(event.clientX - lastPostFiveTap.x, event.clientY - lastPostFiveTap.y) <= 72) {
        addTapWave(event.clientX, event.clientY, true);
        lastPostFiveTap = null;
      } else {
        lastPostFiveTap = { at: now, x: event.clientX, y: event.clientY };
      }
    }, { passive: true });

    document.addEventListener("pointercancel", event => {
      if (pendingPointer && event.pointerId === pendingPointer.id) pendingPointer = null;
    }, { passive: true });

    window.addEventListener("scroll", () => {
      if (pendingPointer && (window.scrollX !== pendingPointer.pageX || window.scrollY !== pendingPointer.pageY)) {
        pendingPointer.scrolled = true;
      }
      // A scroll breaks a double-tap sequence; scrolling itself never spawns a wave.
      lastPostFiveTap = null;
    }, { passive: true, capture: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = requestAnimationFrame(animate);
    });
    reducedMotion.addEventListener?.("change", () => { if (!raf && !document.hidden) raf = requestAnimationFrame(animate); });
    resize();
    raf = requestAnimationFrame(animate);
  })();
})();

/* ===== Added from upgrade.js ===== */
/* ============================================================
   403 UPGRADE PACK (lite) — sparkle trail only
   ============================================================ */
(() => {
  "use strict";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PALETTE = ["#1e211b", "#d0e982", "#ffb5cf", "#ffdf58", "#a9c9ff", "#d0baff"];
  const GLYPHS = ["✦", "✳", "✧", "•", "·"];
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  let lastSpark = 0;
  addEventListener("pointermove", e => {
    if (reduceMotion || e.pointerType === "touch") return;
    const now = performance.now();
    if (now - lastSpark < 75) return; // Original 75ms particle cadence.
    lastSpark = now;
    const s = document.createElement("span");
    s.className = "spark";
    s.textContent = pick(GLYPHS);
    s.setAttribute("aria-hidden", "true");
    s.style.left = e.clientX + "px";
    s.style.top = e.clientY + "px";
    s.style.color = pick(PALETTE);
    document.body.append(s);
    setTimeout(() => s.remove(), 900); // Original 900ms particle lifetime.
  }, { passive: true });
})();

/* ============================================================
   MYSTIC MODE CONTROLLER
   Formerly mystic-mode.js; kept after the main interaction
   controller to preserve the original deferred script order.
   ============================================================ */

/* Mystic mode controller for 403 degrees of Apon.
   The atmospheric scene mirrors the standalone Mystic background while remaining reversible. */
(() => {
  "use strict";
  const toggle = document.getElementById("mysticToggle");
  const toggleLabel = toggle?.querySelector(".mystic-toggle-label");
  const toggleIcon = toggle?.querySelector(".mystic-toggle-moon");
  const environment = document.getElementById("mysticEnvironment");
  const starField = document.getElementById("mysticStars");
  const shootingField = document.getElementById("mysticShootingStars");
  const fireflyCanvas = document.getElementById("mysticFireflies");
  const cursorGlow = document.getElementById("mysticCursorGlow");
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!toggle || !toggleLabel || !toggleIcon || !environment || !starField || !shootingField || !fireflyCanvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "aponMysticMode";
  const ctx = fireflyCanvas.getContext("2d", { alpha: true });
  const finePointer = window.matchMedia("(pointer:fine)").matches;
  let active = false;
  let animationFrame = 0;
  let cometTimer = 0;
  let particles = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cursorPositionKnown = false;
  let activeComets = 0;
  let lastCometAt = 0;

  // Same quiet, randomised sky as the original Mystic site: 155 tiny points, mostly above the ridge.
  function buildStars() {
    if (starField.childElementCount) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 155; i += 1) {
      const star = document.createElement("i");
      star.className = `mystic-star${Math.random() > 0.91 ? " is-large" : ""}`;
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 62}%`;
      star.style.setProperty("--duration", `${2.2 + Math.random() * 5}s`);
      star.style.setProperty("--delay", `${Math.random() * -7}s`);
      fragment.appendChild(star);
    }
    starField.appendChild(fragment);
  }

  // Match the standalone scene's size, density, colour variation and lower-sky distribution.
  function resizeFireflies() {
    const bounds = environment.getBoundingClientRect();
    width = Math.max(1, bounds.width || window.innerWidth);
    height = Math.max(1, bounds.height || window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    fireflyCanvas.width = Math.round(width * dpr);
    fireflyCanvas.height = Math.round(height * dpr);
    fireflyCanvas.style.width = `${width}px`;
    fireflyCanvas.style.height = `${height}px`;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(85, Math.max(35, Math.floor(width / 10)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: height * (0.48 + Math.random() * 0.5),
      radius: 0.8 + Math.random() * 2.1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.55,
      dx: (Math.random() - 0.5) * 0.22,
      dy: (Math.random() - 0.5) * 0.16,
      hue: Math.random() > 0.78 ? 170 : 135
    }));
  }

  function paintFireflies(now = 0) {
    if (!active || !ctx) { animationFrame = 0; return; }
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      if (!reduceMotion.matches) { p.x += p.dx; p.y += p.dy; }
      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;
      if (p.y < height * 0.43) p.y = height * 0.92;
      if (p.y > height) p.y = height * 0.45;
      const pulse = reduceMotion.matches ? 0.55 : 0.22 + (Math.sin(now * 0.001 * p.speed + p.phase) + 1) * 0.34;
      const radius = p.radius * (1 + pulse * 0.4);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 95%, 76%, ${pulse})`;
      ctx.shadowBlur = 10 * pulse;
      ctx.shadowColor = `hsla(${p.hue}, 95%, 68%, ${pulse})`;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (!reduceMotion.matches) animationFrame = window.requestAnimationFrame(paintFireflies);
    else animationFrame = 0;
  }

  // Same subtle shooting stars as Mystic: no more than two, with a diagonal right-to-left trail.
  function addComet() {
    if (!active || reduceMotion.matches || document.hidden || activeComets >= 2) return;
    const comet = document.createElement("i");
    comet.className = "mystic-comet";
    comet.style.left = `${35 + Math.random() * 60}%`;
    comet.style.top = `${Math.random() * 42}%`;
    const duration = 1.25 + Math.random() * 0.45;
    comet.style.setProperty("--comet-duration", `${duration}s`);
    if (Math.random() > 0.7) comet.style.transform = "rotate(-40deg) scale(.78)";
    shootingField.appendChild(comet);
    activeComets += 1;
    comet.addEventListener("animationend", () => {
      comet.remove();
      activeComets = Math.max(0, activeComets - 1);
    }, { once: true });

    if (activeComets === 1 && Math.random() < 0.18) {
      window.setTimeout(() => {
        if (active && activeComets < 2) addComet();
      }, 500 + Math.random() * 900);
    }
    lastCometAt = Date.now();
  }

  function scheduleComet() {
    window.clearTimeout(cometTimer);
    if (!active || reduceMotion.matches || document.hidden) return;
    const wait = lastCometAt ? 4300 + Math.random() * 4800 : 1400 + Math.random() * 1800;
    cometTimer = window.setTimeout(() => {
      addComet();
      scheduleComet();
    }, wait);
  }

  function startEnvironment() {
    buildStars();
    resizeFireflies();
    if (!reduceMotion.matches && !animationFrame) animationFrame = window.requestAnimationFrame(paintFireflies);
    else if (reduceMotion.matches) paintFireflies(0);
    scheduleComet();
  }

  function stopEnvironment() {
    window.clearTimeout(cometTimer);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    shootingField.replaceChildren();
    activeComets = 0;
    if (ctx) ctx.clearRect(0, 0, width, height);
  }

  function setMysticMode(enabled) {
    active = Boolean(enabled);
    document.body.classList.toggle("mystic-mode", active);
    if (cursorGlow) cursorGlow.classList.toggle("is-visible", active && cursorPositionKnown && finePointer);
    toggle.setAttribute("aria-pressed", String(active));
    toggleLabel.textContent = active ? "Crust" : "Mystic";
    toggleIcon.textContent = active ? "☼" : "☾";
    toggle.title = active ? "Switch back to Crust" : "Switch to Mystic forest night mode";
    toggle.setAttribute("aria-label", active ? "Switch to Crust" : "Switch to Mystic mode");
    if (metaTheme) metaTheme.setAttribute("content", active ? "#06130f" : "#f4f1e9");
    environment.setAttribute("aria-hidden", "true");
    if (active) startEnvironment(); else stopEnvironment();
    try { window.localStorage.setItem(storageKey, active ? "on" : "off"); } catch (_) { /* Theme still works in private mode. */ }
  }

  toggle.addEventListener("click", () => setMysticMode(!active));

  // Viewport-fixed glow, like the original Mystic cursor light; it is not a firefly particle.
  if (cursorGlow && finePointer) {
    window.addEventListener("pointermove", event => {
      cursorPositionKnown = true;
      cursorGlow.style.left = `${event.clientX}px`;
      cursorGlow.style.top = `${event.clientY}px`;
      if (active) cursorGlow.classList.add("is-visible");
    }, { passive: true });
  }

  window.addEventListener("resize", () => { if (active) resizeFireflies(); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!active) return;
    if (document.hidden) {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      window.clearTimeout(cometTimer);
    } else {
      if (!reduceMotion.matches && !animationFrame) animationFrame = window.requestAnimationFrame(paintFireflies);
      scheduleComet();
    }
  });
  reduceMotion.addEventListener?.("change", () => {
    if (!active) return;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (reduceMotion.matches) {
      window.clearTimeout(cometTimer);
      paintFireflies(0);
      shootingField.replaceChildren();
      activeComets = 0;
    } else {
      animationFrame = window.requestAnimationFrame(paintFireflies);
      scheduleComet();
    }
  });

  let saved = false;
  try { saved = window.localStorage.getItem(storageKey) === "on"; } catch (_) { saved = false; }
  setMysticMode(saved);
})();
