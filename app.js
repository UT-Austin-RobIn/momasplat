/* MoMaSplat interactive project page */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Run a callback whenever an element enters/leaves the viewport. */
  function onVisible(el, cb, threshold) {
    if (!el) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cb(e.isIntersecting); });
    }, { threshold: threshold || 0.25 }).observe(el);
  }

  /* Keep the filled part of every range slider in sync with its value. */
  function paintRange(r) {
    var pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty("--fill", pct + "%");
  }
  $$('input[type="range"]').forEach(function (r) {
    paintRange(r);
    r.addEventListener("input", function () { paintRange(r); });
  });

  /* ---------------- Scroll progress, nav, reveal ---------------- */
  var bar = $("#progress-bar");
  var nav = $("#nav");
  var page = "home";
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    // The nav floats over the hero on the overview; every other page starts under a solid bar.
    nav.classList.toggle("is-solid", page !== "home" || h.scrollTop > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------- Page router: one nav tab shown at a time ---------------- */
  var ROUTES = { "": "home", "#": "home", "#top": "home", "#overview": "home", "#method": "method", "#splats": "splats", "#results": "results" };
  var pages = {};
  $$(".page").forEach(function (p) { pages[p.dataset.page] = p; });
  var navLinks = $$(".nav-links a");
  var burger = $("#nav-burger");
  function setMenu(open) {
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  }
  burger.addEventListener("click", function () { setMenu(!nav.classList.contains("menu-open")); });

  function show(key, keepScroll) {
    if (!pages[key]) key = "home";
    page = key;
    Object.keys(pages).forEach(function (k) { pages[k].classList.toggle("is-active", k === key); });
    navLinks.forEach(function (a) { a.classList.toggle("is-current", ROUTES[a.getAttribute("href")] === key); });
    setMenu(false);
    if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
    // Layout-dependent widgets (method tour) measured 0x0 while their page was hidden.
    window.dispatchEvent(new Event("resize"));
    onScroll();
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || !ROUTES.hasOwnProperty(a.getAttribute("href"))) return;
    e.preventDefault();
    var href = a.getAttribute("href");
    if (location.hash !== href) history.pushState(null, "", href);
    show(ROUTES[href]);
  });
  window.addEventListener("popstate", function () { show(ROUTES[location.hash] || "home", true); });
  show(ROUTES[location.hash] || "home", true);

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("is-in"); revealObserver.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach(function (el) { revealObserver.observe(el); });

  var heroVideo = $(".hero-bg");
  onVisible($(".hero"), function (vis) {
    if (vis) heroVideo.play().catch(function () {}); else heroVideo.pause();
  }, 0.05);

  /* ---------------- Chaptered real-robot walkthrough ---------------- */
  (function chapters() {
    var root = $("#chapters");
    if (!root) return;
    var video = $("#chap-video"), tag = $("#chap-tag"), playBtn = $("#chap-play");
    var items = $$("#chap-rail li");
    var chaps = items.map(function (li) {
      return { li: li, start: +li.dataset.start, end: +li.dataset.end, bar: $(".chap-bar i", li), name: $("button", li).textContent.trim() };
    });
    var current = -1, userPaused = false, inView = false;

    function setPlayUi() {
      playBtn.classList.toggle("is-paused", video.paused);
      playBtn.setAttribute("aria-label", video.paused ? "Play" : "Pause");
    }
    function which(t) {
      for (var i = chaps.length - 1; i >= 0; i--) if (t >= chaps[i].start - 0.02) return i;
      return 0;
    }
    function update() {
      var t = video.currentTime, i = which(t);
      if (i !== current) {
        current = i;
        chaps.forEach(function (c, j) {
          c.li.classList.toggle("is-on", j === i);
          c.li.classList.toggle("is-done", j < i);
          if (j !== i) c.bar.style.width = "";
        });
        var c = chaps[i];
        tag.textContent = c.name.replace(/^(\d+)\s*/, "$1 · ");
        tag.style.color = getComputedStyle(c.li).getPropertyValue("--step");
      }
      var cc = chaps[current];
      cc.bar.style.width = clamp((t - cc.start) / (cc.end - cc.start), 0, 1) * 100 + "%";
    }
    chaps.forEach(function (c) {
      $("button", c.li).addEventListener("click", function () {
        video.currentTime = c.start + 0.01;
        if (video.paused) { userPaused = false; video.play().catch(function () {}); }
        update();
      });
    });
    playBtn.addEventListener("click", function () {
      if (video.paused) { userPaused = false; video.play().catch(function () {}); }
      else { userPaused = true; video.pause(); }
    });
    video.addEventListener("play", setPlayUi);
    video.addEventListener("pause", setPlayUi);
    video.addEventListener("timeupdate", update);
    function tick() { if (inView && !video.paused) update(); requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
    onVisible(root, function (v) {
      inView = v;
      if (v && !userPaused) video.play().catch(function () {}); else if (!v) video.pause();
    }, 0.35);
    update(); setPlayUi();
  })();

  /* ---------------- Method tour (zoom into the figure) ---------------- */
  (function methodTour() {
    var view = $("#tour-view"), img = $("#tour-img"), badge = $("#tour-badge");
    if (!view) return;
    var steps = $$("#tour-steps li");
    var dotsWrap = $("#tour-dots");
    var labels = ["overview", "source demo", "3.1 reconstruction", "3.1 reconstruction", "3.2 synthesis", "3.2 novel view synthesis", "3.3 imitation learning"];
    var current = 0;

    steps.forEach(function (li, i) {
      var d = document.createElement("button");
      d.setAttribute("aria-label", "Step " + (i + 1));
      d.addEventListener("click", function () { go(i); });
      dotsWrap.appendChild(d);
      li.addEventListener("click", function () { go(i); });
    });
    var dots = $$("button", dotsWrap);

    function apply() {
      var r = steps[current].dataset.region.split(",").map(Number);
      var W = view.clientWidth, H = view.clientHeight;
      var s = Math.max(1, Math.min(1 / r[2], 1 / r[3]) * 0.96);
      var tx = W * (0.5 - (r[0] + r[2] / 2) * s);
      var ty = H * (0.5 - (r[1] + r[3] / 2) * s);
      tx = clamp(tx, W * (1 - s), 0);
      ty = clamp(ty, H * (1 - s), 0);
      img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
    }
    function go(i) {
      current = (i + steps.length) % steps.length;
      steps.forEach(function (li, j) { li.classList.toggle("is-on", j === current); });
      dots.forEach(function (d, j) { d.classList.toggle("is-on", j === current); });
      badge.textContent = (current + 1) + "/" + steps.length + " · " + labels[current];
      apply();
    }
    $("#tour-prev").addEventListener("click", function () { go(current - 1); });
    $("#tour-next").addEventListener("click", function () { go(current + 1); });
    window.addEventListener("resize", apply);

    var inView = false;
    onVisible($("#tour"), function (v) { inView = v; }, 0.4);
    document.addEventListener("keydown", function (e) {
      if (!inView || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
    });
    go(0);
  })();

  /* ---------------- Drag-to-orbit splat viewer ---------------- */
  (function orbitViewer() {
    var stage = $("#orbit-stage"), canvas = $("#orbit-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var range = $("#orbit-range"), loading = $("#orbit-loading"), loadBar = $("#orbit-load-bar");
    var cache = {};
    var scene = null, frames = [], idx = 0, dir = 1;
    var auto = true, idleTimer = null, inView = false, lastTs = null;

    function pad(n) { return ("00" + n).slice(-3); }
    function load(name, count) {
      if (cache[name]) return cache[name];
      var list = [];
      var done = 0;
      for (var i = 0; i < count; i++) {
        var im = new Image();
        im.decoding = "async";
        im.onload = im.onerror = function () {
          done++;
          if (scene === name) {
            loadBar.style.width = (done / count) * 100 + "%";
            loading.classList.toggle("done", done >= count);
            draw();
          }
        };
        im.src = "./media/frames/" + name + "/" + pad(i) + ".jpg";
        list.push(im);
      }
      list.done = function () { return done; };
      cache[name] = list;
      return list;
    }
    function draw() {
      if (!frames.length) return;
      var i = Math.round(idx);
      // Fall back to the nearest frame that has loaded.
      for (var k = 0; k < frames.length; k++) {
        var cand = [i - k, i + k];
        for (var c = 0; c < 2; c++) {
          var f = frames[cand[c]];
          if (f && f.complete && f.naturalWidth) { ctx.drawImage(f, 0, 0, canvas.width, canvas.height); return; }
        }
      }
    }
    function setIdx(v) {
      idx = clamp(v, 0, frames.length - 1);
      range.value = Math.round(idx); paintRange(range);
      draw();
    }
    function select(btn) {
      $$(".seg-btn[data-scene]", stage.parentNode).forEach(function (b) { b.classList.toggle("is-on", b === btn); });
      scene = btn.dataset.scene;
      var count = +btn.dataset.count;
      frames = load(scene, count);
      range.max = count - 1;
      loadBar.style.width = (frames.done() / count) * 100 + "%";
      loading.classList.toggle("done", frames.done() >= count);
      setIdx(0); dir = 1;
    }
    $$(".seg-btn[data-scene]").forEach(function (btn) {
      btn.addEventListener("click", function () { select(btn); });
    });

    function pauseAuto() {
      auto = false;
      stage.classList.add("touched");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { auto = true; }, 5000);
    }
    var dragging = false, startX = 0, startIdx = 0;
    stage.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; startIdx = idx;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
      pauseAuto();
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var perPx = (frames.length - 1) / stage.clientWidth;
      setIdx(startIdx - (e.clientX - startX) * perPx * 1.2);
      pauseAuto();
    });
    function endDrag() { dragging = false; stage.classList.remove("is-dragging"); }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    range.addEventListener("input", function () { pauseAuto(); setIdx(+range.value); });

    function loop(ts) {
      if (inView && auto && !reduceMotion && frames.length) {
        var dt = lastTs === null ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
        var next = idx + dir * dt * 14;
        if (next >= frames.length - 1 || next <= 0) dir = -dir;
        setIdx(next);
      }
      lastTs = ts;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    onVisible(stage, function (v) {
      inView = v;
      if (v && !scene) select($(".seg-btn[data-scene].is-on"));
    }, 0.1);
  })();

  /* ---------------- Generic video tabs (objects, generated demos) ---------------- */
  $$("[data-tabs]").forEach(function (bar) {
    var group = bar.dataset.tabs;
    var panel = $('[data-panels="' + group + '"]');
    var inView = false;
    function current() { return $("video:not([hidden])", panel); }
    $$(".seg-btn", bar).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".seg-btn", bar).forEach(function (b) { b.classList.toggle("is-on", b === btn); });
        $$("video", panel).forEach(function (v) {
          var on = v.dataset.key === btn.dataset.key;
          v.hidden = !on;
          if (on) { v.preload = "auto"; v.currentTime = 0; if (inView) v.play().catch(function () {}); }
          else v.pause();
        });
      });
    });
    onVisible(panel, function (v) {
      inView = v;
      var cur = current();
      if (!cur) return;
      if (v) cur.play().catch(function () {}); else cur.pause();
    }, 0.3);
  });

  /* ---------------- Result figure tabs ---------------- */
  $$("[data-figtabs]").forEach(function (bar) {
    var figs = $$("[data-fig]", bar.parentNode);
    $$(".seg-btn", bar).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".seg-btn", bar).forEach(function (b) { b.classList.toggle("is-on", b === btn); });
        figs.forEach(function (f) { f.hidden = f.dataset.fig !== btn.dataset.key; });
      });
    });
  });

  /* ---------------- Real-robot rollouts ---------------- */
  (function rollouts() {
    var grid = $("#rollouts");
    if (!grid) return;
    var vids = $$("video", grid);
    onVisible(grid, function (v) {
      vids.forEach(function (vid) {
        if (v) { vid.preload = "auto"; vid.play().catch(function () {}); } else vid.pause();
      });
    }, 0.15);
    $$(".roll", grid).forEach(function (fig) {
      fig.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "mouse") return;
        grid.classList.add("has-focus");
        fig.classList.add("is-focus");
      });
      fig.addEventListener("pointerleave", function () {
        grid.classList.remove("has-focus");
        fig.classList.remove("is-focus");
      });
    });
  })();

  /* ---------------- Media viewer (click to enlarge, with prev/next) ---------------- */
  (function viewer() {
    var box = $("#viewer"), media = $("#viewer-media"), caption = $("#viewer-caption");
    var items = [], index = 0, lastFocus = null;

    // Every [data-lb] element belongs to a group; prev/next walks that group.
    function describe(el) {
      if (el.dataset.full) return { kind: "img", src: el.dataset.full, caption: el.dataset.caption, alt: $("img", el).alt };
      var v = el.tagName === "VIDEO" ? el : $("video", el);
      return { kind: "video", src: v.currentSrc || v.src, caption: el.dataset.caption, time: v.currentTime, w: v.videoWidth, h: v.videoHeight };
    }
    function render() {
      var it = items[index];
      media.innerHTML = "";
      var node;
      if (it.kind === "img") {
        node = document.createElement("img");
        node.src = it.src; node.alt = it.alt || "";
      } else {
        node = document.createElement("video");
        node.src = it.src; node.controls = true; node.playsInline = true;
        node.muted = !it.sound; node.loop = !it.sound;
        if (it.time) node.currentTime = it.time;
        // Size the frame up front from the clip's aspect ratio, and don't blow small clips up past ~1.8x.
        function size(w, h) {
          var ar = w && h ? w / h : 16 / 9;
          var maxPx = w ? Math.min(1200, w * 1.8) : 1200;
          node.style.aspectRatio = ar;
          node.style.width = "min(88vw, " + maxPx + "px, " + (78 * ar).toFixed(1) + "vh)";
        }
        size(it.w, it.h);
        node.addEventListener("loadedmetadata", function () { size(node.videoWidth, node.videoHeight); });
        node.play().catch(function () {});
      }
      media.appendChild(node);
      caption.textContent = it.caption || "";
      box.classList.toggle("single", items.length < 2);
    }
    function open(list, i) {
      items = list; index = i;
      lastFocus = document.activeElement;
      box.hidden = false;
      document.body.classList.add("no-scroll");
      render();
      $(".viewer-close", box).focus();
    }
    function close() {
      box.hidden = true;
      media.innerHTML = "";
      document.body.classList.remove("no-scroll");
      if (lastFocus) lastFocus.focus();
    }
    function step(d) { index = (index + d + items.length) % items.length; render(); }

    $$("[data-lb]").forEach(function (el) {
      var trigger = el.closest(".gen-frame") || el;
      if (trigger !== el && trigger.dataset.bound) return;
      trigger.dataset.bound = "1";
      trigger.addEventListener("click", function () {
        var group = $$('[data-lb="' + el.dataset.lb + '"]');
        // For tabbed panels, open whichever item is showing.
        var shown = trigger === el ? el : $("[data-lb]:not([hidden])", trigger);
        open(group.map(describe), group.indexOf(shown));
      });
    });

    $(".viewer-close", box).addEventListener("click", close);
    $(".viewer-nav.prev", box).addEventListener("click", function () { step(-1); });
    $(".viewer-nav.next", box).addEventListener("click", function () { step(1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && items.length > 1) step(1);
      else if (e.key === "ArrowLeft" && items.length > 1) step(-1);
    });
  })();
})();
