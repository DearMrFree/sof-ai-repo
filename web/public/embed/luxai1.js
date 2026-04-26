/*
 * LuxAI1 embeddable widget for All In One (AI1) Bay Area.
 *
 * Drop on any page with a single tag:
 *   <script src="https://sof.ai/embed/luxai1.js" async defer></script>
 *
 * Renders a floating chat bubble bottom-right. Conversation persists in
 * localStorage so a return visitor picks up where they left off. All
 * styling happens inside a Shadow DOM so the widget cannot fight the
 * host site's CSS, and vice versa.
 *
 * The widget POSTs to https://sof.ai/api/embed/luxai1/chat which runs the
 * Anthropic tool-use loop server-side and sends Blajon a lead email when
 * a customer is ready to book.
 *
 * Trained at sof.ai. Unbranded UX intentionally — the customer should
 * feel like they're talking to AI1's concierge, not a third-party bot.
 */
(function () {
  "use strict";

  // Already mounted? (someone double-included the script — bail.)
  if (window.__LUXAI1_MOUNTED__) return;
  window.__LUXAI1_MOUNTED__ = true;

  // Resolve the API host from the script's own src so previewing on a
  // staging domain (e.g. v0-…vercel.app) still works.
  var SCRIPT = (function () {
    var nodes = document.getElementsByTagName("script");
    for (var i = 0; i < nodes.length; i++) {
      var src = nodes[i].src || "";
      if (src.indexOf("/embed/luxai1.js") !== -1) return nodes[i];
    }
    return null;
  })();
  var API_BASE = (function () {
    if (SCRIPT) {
      try {
        var u = new URL(SCRIPT.src);
        return u.origin;
      } catch (e) {}
    }
    return "https://sof.ai";
  })();
  var CHAT_URL = API_BASE + "/api/embed/luxai1/chat";

  var STORAGE_KEY = "luxai1.thread.v1";
  var GREETING =
    "Hi! I'm LuxAI1, AI1 Bay Area's concierge. How can I help — moving, landscaping, hauling, or something else?";

  // ---------- Storage ----------
  function loadThread() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (m) {
        return (
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        );
      });
    } catch (e) {
      return [];
    }
  }
  function saveThread(thread) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(thread));
    } catch (e) {}
  }
  function clearThread() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // ---------- DOM ----------
  var host = document.createElement("div");
  host.setAttribute("id", "luxai1-widget");
  host.style.cssText =
    "position:fixed;bottom:0;right:0;z-index:2147483640;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;";
  var shadow = host.attachShadow({ mode: "open" });

  var STYLE = [
    ":host{all:initial}",
    "*,*::before,*::after{box-sizing:border-box}",
    ".bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border:none;cursor:pointer;box-shadow:0 10px 30px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;transition:transform .15s ease}",
    ".bubble:hover{transform:scale(1.05)}",
    ".bubble svg{width:28px;height:28px}",
    ".panel{position:fixed;bottom:24px;right:24px;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 48px);background:#ffffff;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.25);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(15,23,42,.08)}",
    ".header{padding:16px 18px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;display:flex;align-items:center;gap:12px}",
    ".avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;font-weight:700;color:#0f172a}",
    ".header-text{flex:1;line-height:1.2}",
    ".header-text .name{font-size:14px;font-weight:600}",
    ".header-text .sub{font-size:11px;opacity:.7}",
    ".close{background:transparent;border:none;color:#fff;cursor:pointer;padding:4px;opacity:.7}",
    ".close:hover{opacity:1}",
    ".thread{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}",
    ".msg{max-width:85%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}",
    ".msg.assistant{align-self:flex-start;background:#ffffff;color:#0f172a;border:1px solid rgba(15,23,42,.06)}",
    ".msg.user{align-self:flex-end;background:#0f172a;color:#fff}",
    ".msg.lead{align-self:center;background:#dcfce7;color:#166534;font-size:12px;border:1px solid #86efac;padding:6px 12px;border-radius:999px}",
    ".typing{align-self:flex-start;display:flex;gap:4px;padding:9px 13px;background:#fff;border-radius:14px;border:1px solid rgba(15,23,42,.06)}",
    ".typing span{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:bounce 1s infinite}",
    ".typing span:nth-child(2){animation-delay:.15s}",
    ".typing span:nth-child(3){animation-delay:.3s}",
    "@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}",
    ".form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(15,23,42,.08);background:#fff}",
    ".input{flex:1;border:1px solid rgba(15,23,42,.15);border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;resize:none;outline:none;line-height:1.4;max-height:80px}",
    ".input:focus{border-color:#0f172a}",
    ".send{background:#0f172a;color:#fff;border:none;border-radius:10px;padding:0 14px;cursor:pointer;font-weight:600;font-size:14px}",
    ".send:disabled{opacity:.4;cursor:not-allowed}",
    ".footer{padding:6px 12px;background:#fff;border-top:1px solid rgba(15,23,42,.04);font-size:10px;color:#94a3b8;text-align:center}",
    ".footer a{color:#94a3b8;text-decoration:none}",
    ".footer a:hover{text-decoration:underline}",
    ".reset{background:transparent;border:none;color:#94a3b8;font-size:11px;cursor:pointer;padding:0}",
    ".reset:hover{color:#0f172a}",
    ".hidden{display:none !important}",
    "@media (max-width:480px){.panel{bottom:0;right:0;width:100vw;height:100vh;max-height:100vh;border-radius:0}.bubble{bottom:16px;right:16px}}",
  ].join("");

  var styleEl = document.createElement("style");
  styleEl.textContent = STYLE;
  shadow.appendChild(styleEl);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Chat with LuxAI1");
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  var panel = document.createElement("div");
  panel.className = "panel hidden";
  panel.innerHTML =
    '<div class="header">' +
    '<div class="avatar">AI1</div>' +
    '<div class="header-text"><div class="name">LuxAI1</div><div class="sub">AI1 Bay Area concierge \u00b7 trained at <a href="https://sof.ai" style="color:inherit">sof.ai</a></div></div>' +
    '<button class="close" aria-label="Close">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
    "</button>" +
    "</div>" +
    '<div class="thread" id="thread"></div>' +
    '<form class="form">' +
    '<textarea class="input" rows="1" placeholder="Ask about a service, get a quote..." maxlength="3500"></textarea>' +
    '<button type="submit" class="send">Send</button>' +
    "</form>" +
    '<div class="footer">' +
    '<button class="reset" type="button">Start over</button>' +
    " \u00b7 Powered by " +
    '<a href="https://sof.ai" target="_blank" rel="noopener">sof.ai</a>' +
    "</div>";

  shadow.appendChild(bubble);
  shadow.appendChild(panel);
  document.body.appendChild(host);

  var threadEl = panel.querySelector("#thread");
  var formEl = panel.querySelector(".form");
  var inputEl = panel.querySelector(".input");
  var sendEl = panel.querySelector(".send");
  var closeEl = panel.querySelector(".close");
  var resetEl = panel.querySelector(".reset");

  var thread = loadThread();
  var pending = false;

  function scrollDown() {
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function addMsg(role, content, opts) {
    var el = document.createElement("div");
    el.className = "msg " + role + (opts && opts.lead ? " lead" : "");
    el.textContent = content;
    threadEl.appendChild(el);
    scrollDown();
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "typing";
    el.id = "typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    threadEl.appendChild(el);
    scrollDown();
  }
  function hideTyping() {
    var el = shadow.getElementById("typing");
    if (el) el.parentNode.removeChild(el);
  }

  function renderThread() {
    threadEl.innerHTML = "";
    if (thread.length === 0) {
      addMsg("assistant", GREETING);
    } else {
      thread.forEach(function (m) {
        addMsg(m.role, m.content);
      });
    }
  }

  function openPanel() {
    panel.classList.remove("hidden");
    bubble.classList.add("hidden");
    setTimeout(function () {
      inputEl.focus();
    }, 50);
    renderThread();
  }
  function closePanel() {
    panel.classList.add("hidden");
    bubble.classList.remove("hidden");
  }

  bubble.addEventListener("click", openPanel);
  closeEl.addEventListener("click", closePanel);
  resetEl.addEventListener("click", function () {
    if (pending) return;
    thread = [];
    clearThread();
    renderThread();
  });

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formEl.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    if (pending) return;
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    sendMessage(text);
  });

  function sendMessage(text) {
    pending = true;
    sendEl.disabled = true;
    thread.push({ role: "user", content: text });
    saveThread(thread);
    addMsg("user", text);
    showTyping();

    fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: thread }),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (json) {
            return { ok: res.ok, status: res.status, body: json };
          });
      })
      .then(function (out) {
        hideTyping();
        var reply =
          out.body && out.body.reply
            ? out.body.reply
            : out.ok
              ? "Sorry — I had trouble there. Please call (408) 872-8340 and Blajon's team will help directly."
              : "I'm having trouble reaching the server. Please try again, or call (408) 872-8340.";
        thread.push({ role: "assistant", content: reply });
        saveThread(thread);
        addMsg("assistant", reply);
        if (out.body && out.body.lead_submitted) {
          addMsg(
            "assistant",
            "\u2713 Sent to Blajon \u2014 he'll be in touch soon.",
            { lead: true },
          );
        }
      })
      .catch(function () {
        hideTyping();
        // Push the error reply into the running thread + persist it.
        // Without this, the saved transcript ends with an unanswered
        // user message; the next turn would push a second consecutive
        // user role and Anthropic (which requires strict alternation)
        // 400s every subsequent send until "Start over" is clicked.
        var errMsg =
          "I'm offline for a moment. Please call (408) 872-8340 or email luxservicesbayarea@gmail.com and Blajon will help directly.";
        thread.push({ role: "assistant", content: errMsg });
        saveThread(thread);
        addMsg("assistant", errMsg);
      })
      .then(function () {
        pending = false;
        sendEl.disabled = false;
        inputEl.focus();
      });
  }

  // If a deep-link query param `?luxai1=open` is present, auto-open the
  // panel — handy for marketing CTAs that want to land visitors directly
  // in the concierge thread.
  try {
    if (window.location.search.indexOf("luxai1=open") !== -1) {
      setTimeout(openPanel, 250);
    }
  } catch (e) {}
})();
