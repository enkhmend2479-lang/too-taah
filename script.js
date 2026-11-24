(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("guess"), submit = $("submit"), errorEl = $("error"), message = $("message");
  const HEAT = { hot: "Маш ойр 🔥", warm: "Ойртож байна", cold: "Холуур" };
  const COLORS = ["#ffb020", "#3de0d0", "#ff5c8a", "#6aa8ff", "#ece8ff"];
  let state = null;

  async function api(url, body) {
    try {
      const res = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch {
      return { ok: false, error: "Сервертэй холбогдож чадсангүй." };
    }
  }

  function showError(text) {
    errorEl.textContent = text;
    input.classList.remove("shake");
    void input.offsetWidth;
    if (text) input.classList.add("shake");
  }

  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < 70; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.style.cssText = `left:${Math.random() * 100}vw;background:${COLORS[i % COLORS.length]};` +
        `--dx:${Math.random() * 200 - 100}px;--r:${Math.random() * 720}deg;--t:${1.8 + Math.random() * 1.6}s`;
      document.body.appendChild(s);
      s.addEventListener("animationend", () => s.remove());
    }
  }

  function render(result, text) {
    const { max, history, over, answer, level, best, wins, total, points } = state;
    let lo = 1, hi = max;
    history.forEach((h) => {
      if (h.result === "low") lo = Math.max(lo, h.guess + 1);
      if (h.result === "high") hi = Math.min(hi, h.guess - 1);
    });
    const fill = $("range-fill");
    fill.style.left = ((lo - 1) / max) * 100 + "%";
    fill.style.width = ((hi - lo + 1) / max) * 100 + "%";
    $("range-text").textContent = over ? answer : `${lo} – ${hi}`;
    $("attempts").textContent = history.length;

    $("history").innerHTML = history.map((h) => {
      const arrow = h.result === "low" ? "↑" : h.result === "high" ? "↓" : "✓";
      return `<li class="${h.result === "win" ? "win" : h.heat}" title="${HEAT[h.heat]}">${h.guess} ${arrow}</li>`;
    }).join("");

    message.className = "message" + (over ? " win" : "");
    if (over) message.textContent = `${text} +${points} оноо (${history.length} оролдлого)`;
    else if (result) message.textContent = `${text} — ${HEAT[history.at(-1).heat]}`;
    else message.textContent = `1–${max} хооронд тоо бодлоо. Таа!`;

    document.querySelectorAll(".level").forEach((b) => b.classList.toggle("active", b.dataset.level === level));
    $("wins").textContent = wins;
    $("total").textContent = total;
    const b = best[level];
    $("best").textContent = b ? `${b.score} оноо (${b.attempts} оролдлого)` : "–";
    input.disabled = submit.disabled = over;
    if (!over) input.focus({ preventScroll: true });
  }

  async function guess() {
    showError("");
    const data = await api("/api/guess", { guess: input.value.trim() });
    if (!data.ok) return showError(data.error);
    state = data.state;
    input.value = "";
    render(data.result, data.message);
    if (data.result === "win") confetti();
  }

  async function newGame(level) {
    const data = await api("/api/new", level ? { level } : {});
    if (!data.ok) return showError(data.error);
    state = data.state;
    showError("");
    input.value = "";
    render();
  }

  input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, ""); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !submit.disabled) guess(); });
  submit.addEventListener("click", guess);
  $("restart").addEventListener("click", () => newGame());
  document.querySelectorAll(".level").forEach((b) => b.addEventListener("click", () => newGame(b.dataset.level)));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  });

  api("/api/state").then((d) => { if (d.ok) { state = d.state; render(); } });
})();
