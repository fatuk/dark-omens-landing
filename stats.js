// Блок «Летопись» на главной: сводка по всем сыгранным партиям с публичного
// API реле (/stats). Только агрегаты — сыщики, Древние, счётчики; никаких ников.
// Пока партий мало (< MIN_GAMES), блок не показываем — «0 % побед из двух»
// на витрине смотрится хуже, чем ничего. Локальный ?api= порог снимает.

(function () {
  const API_DEFAULT = "https://dark-omens-backend.onrender.com";
  // ?api= — только локальный бэкенд (см. chronicle.js: подмена данных на домене).
  const API_LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const MIN_GAMES = 10;

  const T = {
    ru: {
      games: "партий завершено",
      winRate: "Древний повержен",
      winOf: (v, n) => `${v} из ${n} партий`,
      fallen: "сыщиков пало",
      fallenOf: (s) => `из ${s} вышедших во тьму`,
      avg: "раундов в партии",
      avgSub: (m) => `в среднем, ≈ ${m} мин`,
      ancients: "Древние",
      ancientRow: (v, n) => `${v} из ${n}`,
      reasons: "Как приходит конец",
      reason: {
        doom: "Рок дошёл до Часов",
        dead: "Пали все сыщики",
        mythos: "Иссякла колода Мифов",
        effect: "Роковая карта",
      },
      investigators: "Кого берут чаще",
      invRow: (g, s) => `${g} ${plural(g, ["партия", "партии", "партий"])} · выживаемость ${s}%`,
      party: "Размер отряда",
      partyLabels: { 1: "соло", 2: "двое", 3: "трое", "4+": "4+" },
      length: "Длительность, мин",
      gamesTip: (n) => `${n} ${plural(n, ["партия", "партии", "партий"])}`,
    },
    en: {
      games: "games completed",
      winRate: "Ancient One defeated",
      winOf: (v, n) => `${v} of ${n} games`,
      fallen: "investigators fallen",
      fallenOf: (s) => `of ${s} who walked into the dark`,
      avg: "rounds per game",
      avgSub: (m) => `on average, ≈ ${m} min`,
      ancients: "Ancient Ones",
      ancientRow: (v, n) => `${v} of ${n}`,
      reasons: "How the end comes",
      reason: {
        doom: "Doom reached the Clock",
        dead: "Every investigator fell",
        mythos: "The Mythos deck ran out",
        effect: "A fatal card",
      },
      investigators: "Most chosen",
      invRow: (g, s) => `${g} game${g === 1 ? "" : "s"} · survived ${s}%`,
      party: "Party size",
      partyLabels: { 1: "solo", 2: "two", 3: "three", "4+": "4+" },
      length: "Length, min",
      gamesTip: (n) => `${n} game${n === 1 ? "" : "s"}`,
    },
  };

  function plural(n, forms) {
    const m10 = n % 10,
      m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
    return forms[2];
  }

  function fmtNum(v) {
    const lang = document.documentElement.lang === "en" ? "en" : "ru";
    return Number(v).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB");
  }

  function apiInfo() {
    const q = new URLSearchParams(location.search).get("api");
    const local = !!q && API_LOCAL_RE.test(q.replace(/\/$/, ""));
    return { base: (local ? q : API_DEFAULT).replace(/\/$/, ""), local };
  }

  function kebab(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.style.cssText = v;
      else n.setAttribute(k, v);
    }
    for (const c of children || []) if (c) n.append(c);
    return n;
  }

  // Горизонтальная полоса-метр: доля 0..1, подпись слева, значение справа.
  function meterRow(label, value, frac, tip) {
    return el("div", { class: "lg-row", title: tip || "" }, [
      el("div", { class: "lg-row-head" }, [
        el("span", { class: "lg-row-label", text: label }),
        el("span", { class: "lg-row-val", text: value }),
      ]),
      el("div", { class: "lg-track" }, [
        el("div", {
          class: "lg-fill",
          style: `width:${Math.max(0, Math.min(1, frac)) * 100}%`,
        }),
      ]),
    ]);
  }

  // Вертикальные столбики (размер отряда, длительность): подпись под столбиком.
  function columns(items, tipOf) {
    const max = Math.max(1, ...items.map((i) => i.n));
    return el(
      "div",
      { class: "lg-cols" },
      items.map((i) =>
        el("div", { class: "lg-col", title: tipOf(i.n) }, [
          el("span", { class: "lg-col-val", text: i.n ? String(i.n) : "" }),
          el("div", { class: "lg-col-bar-wrap" }, [
            el("div", {
              class: "lg-col-bar" + (i.n ? "" : " empty"),
              style: `height:${(i.n / max) * 100}%`,
            }),
          ]),
          el("span", { class: "lg-col-label", text: i.label }),
        ]),
      ),
    );
  }

  function panel(title, body, wide) {
    return el("div", { class: "lg-panel" + (wide ? " wide" : "") }, [
      el("h3", { text: title }),
      body,
    ]);
  }

  function tile(big, label, sub, frac) {
    return el("div", { class: "lg-tile" }, [
      el("div", { class: "lg-big", text: big }),
      el("div", { class: "lg-label", text: label }),
      sub ? el("div", { class: "lg-sub", text: sub }) : null,
      frac == null
        ? null
        : el("div", { class: "lg-track" }, [
            el("div", { class: "lg-fill", style: `width:${frac * 100}%` }),
          ]),
    ]);
  }

  function investigatorRow(inv, lang, t) {
    const name = inv.name[lang] || inv.nameEn;
    const surv = inv.games ? Math.round((inv.survived / inv.games) * 100) : 0;
    const img = el("img", {
      src: `images/portraits/investigators/${kebab(inv.nameEn)}.webp`,
      alt: "",
      loading: "lazy",
    });
    const face = el("div", { class: "lg-face" }, [img]);
    img.addEventListener("error", () => {
      img.remove();
      face.textContent = name.slice(0, 1);
    });
    return el("div", { class: "lg-inv" }, [
      face,
      el("div", {}, [
        el("div", { class: "lg-inv-name", text: name }),
        el("div", { class: "lg-inv-sub", text: t.invRow(inv.games, surv) }),
      ]),
    ]);
  }

  function render(root, s) {
    const lang = document.documentElement.lang === "en" ? "en" : "ru";
    const t = T[lang];
    const tot = s.totals;

    const tiles = el("div", { class: "lg-tiles" }, [
      tile(fmtNum(tot.games), t.games),
      tile(`${tot.winRate}%`, t.winRate, t.winOf(tot.victories, tot.games), tot.winRate / 100),
      tile(fmtNum(tot.fallen), t.fallen, t.fallenOf(tot.seats)),
      tile(fmtNum(tot.avgRounds), t.avg, t.avgSub(tot.avgMinutes)),
    ]);

    const panels = [];
    panels.push(
      panel(
        t.ancients,
        el(
          "div",
          {},
          s.ancients.map((a) =>
            meterRow(
              a.name[lang] || a.key,
              `${a.winRate}%`,
              a.winRate / 100,
              `${t.winRate}: ${t.ancientRow(a.victories, a.games)}`,
            ),
          ),
        ),
      ),
    );

    const reasons = Object.entries(s.defeatReasons || {}).filter(([k]) => t.reason[k]);
    const lost = reasons.reduce((sum, [, n]) => sum + n, 0);
    if (lost > 0) {
      panels.push(
        panel(
          t.reasons,
          el(
            "div",
            {},
            reasons
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) =>
                meterRow(t.reason[k], `${Math.round((n / lost) * 100)}%`, n / lost, t.gamesTip(n)),
              ),
          ),
        ),
      );
    }

    if (s.investigators.length) {
      panels.push(
        panel(
          t.investigators,
          el(
            "div",
            { class: "lg-invs" },
            s.investigators.map((i) => investigatorRow(i, lang, t)),
          ),
          true,
        ),
      );
    }

    panels.push(
      panel(
        t.party,
        columns(
          ["1", "2", "3", "4+"].map((k) => ({
            label: t.partyLabels[k],
            n: s.partySizes[k] || 0,
          })),
          t.gamesTip,
        ),
      ),
    );
    panels.push(
      panel(
        t.length,
        columns(
          s.lengths.map((b) => ({
            label: b.to == null ? `${b.from}+` : `${b.from}–${b.to}`,
            n: b.games,
          })),
          t.gamesTip,
        ),
      ),
    );

    root.replaceChildren(tiles, el("div", { class: "lg-panels" }, panels));
  }

  async function init() {
    const section = document.getElementById("ledger");
    const root = document.getElementById("ledger-body");
    if (!section || !root) return;
    const { base, local } = apiInfo();
    let data;
    try {
      const res = await fetch(`${base}/stats`);
      if (!res.ok) return;
      data = await res.json();
    } catch (e) {
      return; // API спит/недоступен — блок просто не показываем
    }
    if (!data || !data.totals || (!local && data.totals.games < MIN_GAMES)) return;
    render(root, data);
    section.hidden = false;
    document.addEventListener("langchange", () => render(root, data));
  }

  init();
})();
