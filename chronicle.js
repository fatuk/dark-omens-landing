// Хроники партий: список (chronicles.html) и одна история (chronicle.html?s=<slug>).
// Данные — с публичного API реле (/chronicles). Только опубликованное, только
// сыщики — никаких ников. Портреты — images/portraits/<kind>/<kebab>.webp.

const API_DEFAULT = "https://dark-omens-backend.onrender.com";

const T = {
  ru: {
    chronicles: "Хроники",
    back: "← Все хроники",
    backHome: "← На главную",
    loading: "Листаем архив…",
    empty: "Архив пока пуст — первые хроники появятся после первых партий.",
    error: "Архив недоступен. Попробуйте позже.",
    cast: "Действующие лица",
    monsters: "Твари, встреченные в пути",
    victory: "победа",
    defeat: "поражение",
    rounds: (n) => `${n} раунд${plural(n, ["", "а", "ов"])}`,
    ancient: "Древний",
    played: "сыграно",
    round: "раунд",
    roundsRange: (a, b) => (a === b ? `раунд ${a}` : `раунды ${a}–${b}`),
    prologue: "Пролог",
    epilogue: "Эпилог",
  },
  en: {
    chronicles: "Chronicles",
    back: "← All chronicles",
    backHome: "← Home",
    loading: "Turning the pages…",
    empty:
      "The archive is empty — chronicles appear after the first playthroughs.",
    error: "The archive is unavailable. Try again later.",
    cast: "Dramatis personae",
    monsters: "Things met along the way",
    victory: "victory",
    defeat: "defeat",
    rounds: (n) => `${n} round${n === 1 ? "" : "s"}`,
    ancient: "Ancient One",
    played: "played",
    round: "round",
    roundsRange: (a, b) => (a === b ? `round ${a}` : `rounds ${a}–${b}`),
    prologue: "Prologue",
    epilogue: "Epilogue",
  },
};

function plural(n, forms) {
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

function apiBase() {
  const q = new URLSearchParams(location.search).get("api");
  return (q || API_DEFAULT).replace(/\/$/, "");
}

function kebab(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function portrait(kind, entry) {
  const file = kebab(entry.id) || kebab(entry.nameEn) || kebab(entry.name);
  return `images/portraits/${kind}/${file}.webp`;
}

function pageLang(story) {
  return (story && story.lang === "ru") ||
    (!story && (navigator.language || "").startsWith("ru"))
    ? "ru"
    : "en";
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => el("p", { text: p }));
}

function fmtDate(ms, lang) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function outcomeNode(outcome, t) {
  const cls =
    outcome === "victory"
      ? "outcome-victory"
      : outcome === "defeat"
        ? "outcome-defeat"
        : "";
  return el("b", {
    class: cls,
    text:
      outcome === "victory" ? t.victory : outcome === "defeat" ? t.defeat : "—",
  });
}

// ── Список ───────────────────────────────────────────────────────────────────

async function renderList(root) {
  const lang = pageLang(null);
  const t = T[lang];
  document.title = `Dark Omens — ${t.chronicles}`;
  root.replaceChildren(el("div", { class: "state", text: t.loading }));
  let data;
  try {
    const res = await fetch(`${apiBase()}/chronicles`);
    data = await res.json();
  } catch {
    root.replaceChildren(el("div", { class: "state", text: t.error }));
    return;
  }
  const items = data.chronicles || [];
  if (items.length === 0) {
    root.replaceChildren(el("div", { class: "state", text: t.empty }));
    return;
  }
  const list = el("div", { class: "list" });
  for (const c of items) {
    const tl = T[c.lang === "ru" ? "ru" : "en"];
    const faces = el(
      "div",
      { class: "faces" },
      c.cast.slice(0, 6).map((m) =>
        el("img", {
          src: portrait("investigators", m),
          alt: m.name,
          class: m.dead ? "dead" : "",
          loading: "lazy",
        }),
      ),
    );
    const body = el("div", {}, [
      el("h3", { text: c.title }),
      el("div", { class: "tag", text: c.tagline }),
      el("div", { class: "meta" }, [
        el("span", {}, [
          document.createTextNode(`${tl.ancient}: `),
          el("b", { text: c.ancient }),
        ]),
        el("span", {}, [outcomeNode(c.outcome, tl)]),
        el("span", { text: tl.rounds(c.rounds) }),
        el("span", { text: fmtDate(c.playedAt, c.lang) }),
      ]),
    ]);
    const link = el(
      "a",
      {
        class: "entry",
        href: `chronicle.html?s=${encodeURIComponent(c.slug)}${location.search.includes("api=") ? "&api=" + encodeURIComponent(apiBase()) : ""}`,
      },
      [faces, body],
    );
    list.append(link);
  }
  root.replaceChildren(list);
}

// ── Одна история ─────────────────────────────────────────────────────────────

async function renderStory(root) {
  const slug = new URLSearchParams(location.search).get("s");
  let data;
  try {
    const res = await fetch(
      `${apiBase()}/chronicles/${encodeURIComponent(slug || "")}`,
    );
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch {
    const t = T[pageLang(null)];
    root.replaceChildren(el("div", { class: "state", text: t.error }));
    return;
  }
  const lang = data.lang === "ru" ? "ru" : "en";
  const t = T[lang];
  const s = data.story;
  document.documentElement.lang = lang;
  document.title = `${s.title} — Dark Omens`;
  const back = document.getElementById("back");
  if (back) back.textContent = t.back;

  const fates = new Map((s.cast || []).map((c) => [c.key, c.fate]));
  const castNodes = (data.castDetails || []).map((m) =>
    el("div", { class: `card${m.dead ? " dead" : ""}` }, [
      el("div", { class: "pic" }, [
        el("img", {
          src: portrait("investigators", m),
          alt: m.name,
          loading: "lazy",
        }),
      ]),
      el("div", { class: "name", text: m.name }),
      el("div", { class: "sub", text: m.occupation || "" }),
      el("div", { class: "fate", text: fates.get(m.key) || "" }),
    ]),
  );

  const monsters = (data.monsters || []).filter((m) => m.id || m.nameEn);
  const monsterNodes = monsters.map((m) =>
    el("div", { class: "monster" }, [
      el("img", {
        src: portrait("monsters", m),
        alt: m.name,
        loading: "lazy",
        onerror: "this.style.display='none'",
      }),
      el("span", {}, [
        el("b", { text: m.name }),
        document.createTextNode(m.kills ? ` ×${m.kills}` : ""),
      ]),
    ]),
  );

  root.replaceChildren(
    el("div", {
      class: "eyebrow",
      text: `${t.chronicles} · ${fmtDate(data.playedAt, lang)}`,
    }),
    el("h1", { text: s.title }),
    el("div", { class: "tagline", text: s.tagline }),
    el("div", { class: "meta" }, [
      el("span", {}, [
        document.createTextNode(`${t.ancient}: `),
        el("b", {
          text:
            data.ancient +
            (data.ancientEpithet ? ` — ${data.ancientEpithet}` : ""),
        }),
      ]),
      el("span", {}, [outcomeNode(data.outcome, t)]),
      el("span", { text: t.rounds(data.rounds) }),
    ]),
    el("div", { class: "rule" }),
    el("div", { class: "eyebrow", text: t.cast }),
    el("div", { class: "cast", style: "margin-top:1rem" }, castNodes),
    el("div", { class: "rule" }),
    el("section", { class: "prologue" }, [
      el("div", { class: "eyebrow", text: t.prologue }),
      el("div", { class: "prose" }, paragraphs(s.prologue)),
    ]),
    ...(s.chapters || []).map((ch) =>
      el("section", { class: "chapter" }, [
        el("div", {
          class: "rounds",
          text: t.roundsRange(ch.rounds[0], ch.rounds[1]),
        }),
        el("h2", { text: ch.title }),
        el("div", { class: "prose" }, paragraphs(ch.text)),
      ]),
    ),
    el("section", { class: "chapter epilogue" }, [
      el("div", { class: "eyebrow", text: t.epilogue }),
      el("div", { class: "prose" }, paragraphs(s.epilogue)),
    ]),
    ...(monsterNodes.length
      ? [
          el("div", { class: "rule" }),
          el("div", { class: "eyebrow", text: t.monsters }),
          el("div", { class: "monsters" }, monsterNodes),
        ]
      : []),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("chronicle");
  if (!root) return;
  if (root.dataset.mode === "list") renderList(root);
  else renderStory(root);
});
