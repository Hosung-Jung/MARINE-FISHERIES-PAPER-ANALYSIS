// OpenAlex 수산·해양 논문 수집: 제목 + 초록 + topic 라벨 → works.csv
// 실행: node collect_openalex.mjs   (환경변수 MAILTO 에 본인 이메일, 선택: OPENALEX_KEY)

const MAILTO = process.env.MAILTO ?? "YOUR_EMAIL";
const KEY = process.env.OPENALEX_KEY ?? "";
const PER_TOPIC = 5000;
const YEARS = "2015-2025";

// 범주 = OpenAlex topic (정답 라벨로 사용)
const TOPICS = {
  "T14405": "Fisheries and Aquaculture",
  "T11387": "Ichthyology and Marine Biology",
  "T12596": "Cephalopods and Marine Biology",
  "T13485": "Marine and Coastal Ecosystems",
  "T14010": "Food Industry and Aquatic Biology",
  "T12414": "Coastal and Marine Management",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function abstractFromInverted(inv) {
  if (!inv) return "";
  const pos = [];
  for (const [word, idxs] of Object.entries(inv)) for (const i of idxs) pos[i] = word;
  return pos.filter(Boolean).join(" ");
}

const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;

async function getJson(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": `fisheries-embedding-practice (mailto:${MAILTO})` } });
    if (res.ok) return res.json();
    console.error(`HTTP ${res.status}, retry ${attempt}`);
    await sleep(2000 * attempt);
  }
  throw new Error("요청 실패: " + url);
}

const { writeFileSync } = await import("node:fs");
const rows = ["id,group,title,abstract"];
let total = 0;

for (const [topicId, label] of Object.entries(TOPICS)) {
  let cursor = "*";
  let got = 0;
  while (cursor && got < PER_TOPIC) {
    const url =
      `https://api.openalex.org/works?filter=primary_topic.id:${topicId},publication_year:${YEARS},has_abstract:true` +
      `&select=id,title,abstract_inverted_index&per-page=200&cursor=${encodeURIComponent(cursor)}` +
      `&mailto=${encodeURIComponent(MAILTO)}` + (KEY ? `&api_key=${KEY}` : "");
    const data = await getJson(url);
    for (const w of data.results) {
      const abstract = abstractFromInverted(w.abstract_inverted_index);
      if (!w.title || !abstract) continue;
      rows.push([csvCell(w.id), csvCell(label), csvCell(w.title), csvCell(abstract)].join(","));
      got++;
      if (got >= PER_TOPIC) break;
    }
    cursor = data.meta.next_cursor;
    await sleep(150);
  }
  total += got;
  console.log(`${label}: ${got}편`);
}

writeFileSync("works.csv", rows.join("\n"), "utf8");
console.log(`저장 완료: works.csv (${total}편)`);
