#!/usr/bin/env node
// McQForYouDesign Etsy hero image compositor.
// Usage: node make_hero.js --image in.jpg --title "Laser Cut Jig Pack #1" --type digital|physical
//        [--label "xTool F1/F2"] [--badge badge.png] [--caps true|false] [--out hero.jpg] [--font font.woff2] [--size 4000x3000] [--quality 92]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const fail = (m) => { console.error("ERROR: " + m); process.exit(1); };
if (!args.image || !fs.existsSync(args.image)) fail(`--image not found: ${args.image}`);
if (!args.title) fail("--title is required");
if (args.badge && !fs.existsSync(args.badge)) fail(`--badge not found: ${args.badge}`);
if (!["digital", "physical"].includes((args.type || "").toLowerCase())) fail("--type must be digital or physical");
const isDigital = args.type.toLowerCase() === "digital";
const [W, H] = (args.size || "4000x3000").split("x").map(Number);
const quality = Number(args.quality || 92);
const out = args.out || path.join(path.dirname(args.image), path.basename(args.image, path.extname(args.image)) + "_hero.jpg");

const SAGE = "#5B714D", DARK = "#42553A", GOLD = "#CDB276", CREAM = "#F3EBD6";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const b64 = (f) => fs.readFileSync(f).toString("base64");

// Font: Josefin Sans Bold (SIL OFL), bundled in assets/fonts; --font (.woff2/.ttf) overrides it.
const bundledFont = path.join(__dirname, "assets", "fonts", "josefin-sans-latin-700-normal.woff2");
const fontFile = args.font && fs.existsSync(args.font) ? args.font : bundledFont;
if (!fs.existsSync(fontFile)) fail(`Font file not found: ${fontFile}`);
const fontFace = `@font-face{font-family:H;font-weight:700;src:url(data:font/${fontFile.toLowerCase().endsWith(".woff2") ? "woff2" : "ttf"};base64,${b64(fontFile)})}`;

// Badge: --badge overrides the bundled assets/mcq-badge-clean.png. If neither exists a simplified stand-in is drawn.
const bundledBadge = path.join(__dirname, "assets", "mcq-badge-clean.png");
const badgeFile = args.badge || (fs.existsSync(bundledBadge) ? bundledBadge : null);

// Line icons in a 300x300 box.
const icon = {
  printer3d: `<rect x="50" y="55" width="200" height="195" rx="16"/><line x1="50" y1="110" x2="250" y2="110"/><rect x="128" y="110" width="44" height="34" rx="4"/><polygon points="136,144 164,144 150,172"/><line x1="78" y1="226" x2="222" y2="226"/><rect x="128" y="198" width="44" height="28" rx="3"/>`,
  laser: `<rect x="40" y="190" width="220" height="62" rx="12"/><polygon points="62,190 96,86 204,86 238,190"/><line x1="100" y1="128" x2="200" y2="128"/><rect x="134" y="128" width="32" height="26" rx="4"/><line x1="150" y1="154" x2="150" y2="182"/><line x1="128" y1="204" x2="172" y2="204"/>`,
  uv: `<rect x="30" y="190" width="240" height="60" rx="10"/><rect x="50" y="96" width="200" height="30" rx="8"/><line x1="62" y1="126" x2="62" y2="190"/><line x1="238" y1="126" x2="238" y2="190"/><rect x="130" y="126" width="40" height="30" rx="4"/><line x1="140" y1="170" x2="140" y2="176"/><line x1="150" y1="170" x2="150" y2="176"/><line x1="160" y1="170" x2="160" y2="176"/><line x1="104" y1="213" x2="196" y2="213"/>`,
  cnc: `<rect x="40" y="232" width="220" height="24" rx="6"/><line x1="68" y1="232" x2="68" y2="100"/><line x1="232" y1="232" x2="232" y2="100"/><rect x="56" y="88" width="188" height="30" rx="8"/><rect x="130" y="118" width="40" height="62" rx="6"/><polygon points="142,180 158,180 150,218"/>`,
};
const S = 1.8, OFF = 262, topR = 770, botR = 872, C = "#FFFFFF";
const place = (g, cx, cy) => `<g transform="translate(${cx - 150 * S} ${cy - 150 * S}) scale(${S})" fill="none" stroke="${C}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${g}</g>`;
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="560" height="560">
<defs><path id="arcTop" d="M ${1000 - topR * 0.94} ${1000 + topR * 0.342} A ${topR} ${topR} 0 1 1 ${1000 + topR * 0.94} ${1000 + topR * 0.342}"/>
<path id="arcBot" d="M ${1000 - botR} 1000 A ${botR} ${botR} 0 0 0 ${1000 + botR} 1000"/></defs>
<circle cx="1000" cy="1000" r="985" fill="none" stroke="${C}" stroke-width="16"/>
<circle cx="1000" cy="1000" r="708" fill="none" stroke="${C}" stroke-width="14"/>
<text font-family="H" font-weight="700" font-size="124" letter-spacing="6" fill="${C}" text-anchor="middle"><textPath href="#arcTop" startOffset="50%">MCQ FOR YOU DESIGN</textPath></text>
<text font-family="H" font-weight="700" font-size="80" letter-spacing="8" fill="${C}" text-anchor="middle"><textPath href="#arcBot" startOffset="50%">YOUR VISION, OUR PRECISION</textPath></text>
<g stroke="${C}" stroke-width="8" stroke-linecap="round"><line x1="1000" y1="440" x2="1000" y2="960"/><line x1="1000" y1="1040" x2="1000" y2="1560"/><line x1="440" y1="1000" x2="960" y2="1000"/><line x1="1040" y1="1000" x2="1560" y2="1000"/></g>
<polygon points="1000,978 1022,1000 1000,1022 978,1000" fill="${C}"/>
${place(icon.printer3d, 1000 - OFF, 1000 - OFF)}${place(icon.laser, 1000 + OFF, 1000 - OFF)}${place(icon.uv, 1000 - OFF, 1000 + OFF)}${place(icon.cnc, 1000 + OFF, 1000 + OFF)}
</svg>`;

const sx = W / 4000; // scale design units (authored at 4000x3000)
const label = args.label ? esc(args.label) : "";
const html = `<html><head><style>${fontFace}
body{margin:0;background:#fff}
#c{position:relative;width:4000px;height:3000px;overflow:hidden;transform-origin:0 0;transform:scale(${sx});background:#fff}
#photo{position:absolute;inset:0;width:4000px;height:3000px;object-fit:cover}
.frame{position:absolute;inset:0;border:30px solid ${SAGE};box-sizing:border-box}
.band{position:absolute;left:0;top:0;width:4000px;height:450px;background:${SAGE};border-bottom:14px solid ${GOLD};box-sizing:border-box;display:flex;align-items:center;justify-content:center}
#t{font-family:H;font-weight:700;${args.caps !== "false" ? "text-transform:uppercase;" : ""}color:#fff;white-space:nowrap;letter-spacing:6px;text-shadow:0 4px 0 ${DARK}}
.badge{position:absolute;left:90px;bottom:90px;width:620px;height:620px;border-radius:50%;background:${SAGE};border:16px solid ${GOLD};box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.badgeimg{position:absolute;left:90px;bottom:90px;width:620px;height:620px;filter:drop-shadow(0 10px 20px rgba(0,0,0,.3))}
.pill{position:absolute;right:90px;bottom:90px;background:${CREAM};border:12px solid ${SAGE};border-radius:100px;padding:24px 80px;font-family:H;font-weight:700;font-size:150px;color:${SAGE};white-space:nowrap;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.dl{position:absolute;right:90px;top:520px;background:${GOLD};border:12px solid ${SAGE};border-radius:100px;padding:20px 70px 20px 50px;font-family:H;font-weight:700;font-size:120px;color:${DARK};white-space:nowrap;display:flex;align-items:center;gap:36px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.dl svg{width:120px;height:120px}
</style></head><body><div id="c">
<img id="photo" src="data:image/${path.extname(args.image).slice(1).replace("jpg", "jpeg")};base64,${b64(args.image)}">
<div class="frame"></div>
<div class="band"><span id="t">${esc(args.title)}</span></div>
${badgeFile ? `<img class="badgeimg" src="data:image/png;base64,${b64(badgeFile)}">` : `<div class="badge">${logoSvg}</div>`}
${label ? `<div class="pill">${label}</div>` : ""}
${isDigital ? `<div class="dl"><svg viewBox="0 0 24 24" fill="none" stroke="${DARK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6.5 10l5.5 5.5 5.5-5.5M4 20h16"/></svg>DIGITAL DOWNLOAD</div>` : ""}
</div></body></html>`;

(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: W, height: H } });
  await p.setContent(html);
  const info = await p.evaluate(async () => {
    await document.fonts.load("700 100px H"); await document.fonts.ready;
    const t = document.getElementById("t"); const scale = window.innerWidth / 4000;
    const fit = (maxW, maxH) => { let s = 300; t.style.fontSize = s + "px";
      while ((t.getBoundingClientRect().width / scale > maxW || t.getBoundingClientRect().height / scale > maxH) && s > 40) { s -= 4; t.style.fontSize = s + "px"; }
      return s; };
    t.style.whiteSpace = "nowrap"; let s = fit(3560, 380); let lines = 1;
    if (s < 170 && t.textContent.includes(" ")) {
      const words = t.textContent.split(" "); let best = 1, diff = 1e9;
      for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length); if (d < diff) { diff = d; best = i; } }
      t.innerHTML = words.slice(0, best).join(" ") + "<br>" + words.slice(best).join(" ");
      t.style.textAlign = "center"; t.style.lineHeight = "1.02"; s = fit(3560, 390); lines = 2;
    }
    const img = document.getElementById("photo");
    return { titleSize: s, lines, photoW: img.naturalWidth, photoH: img.naturalHeight };
  });
  await p.waitForTimeout(500);
  const isPng = out.toLowerCase().endsWith(".png");
  await p.screenshot({ path: out, type: isPng ? "png" : "jpeg", ...(isPng ? {} : { quality }) });
  // 270px thumbnail check
  const thumb = out.replace(/\.(jpg|jpeg|png)$/i, "") + "_thumb270.png";
  const tp = await br.newPage({ viewport: { width: 270, height: Math.round(270 * H / W) } });
  await tp.setContent(`<body style="margin:0"><img src="data:image/${isPng ? "png" : "jpeg"};base64,${b64(out)}" style="width:270px;display:block">`);
  await tp.screenshot({ path: thumb });
  await br.close();
  console.log(JSON.stringify({ output: out, thumbnailCheck: thumb, titleFontSizePx: info.titleSize, titleLines: info.lines, photo: `${info.photoW}x${info.photoH}`, badge: badgeFile ? path.basename(badgeFile) : "stand-in (assets/mcq-badge-clean.png missing)", warnings: [
    info.titleSize < 110 ? "Title is very long even on two lines; consider a shorter product name." : null,
    !badgeFile ? "Badge PNG not found; a simplified stand-in badge was drawn. Add assets/mcq-badge-clean.png." : null,
    info.photoW < W / 2 || info.photoH < H / 2 ? `Source photo (${info.photoW}x${info.photoH}) is under half the output size; it was upscaled and may look soft.` : null].filter(Boolean) }, null, 2));
})();
