import fs from "node:fs";

const [target, base] = process.argv.slice(2);
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

if (!target || !base) {
  console.error("usage: node scripts/check-redirect.mjs <target-url> <legacy-base-path>");
  process.exit(2);
}

let origin;
try {
  const parsed = new URL(target);
  check(parsed.protocol === "https:", "target URL must use HTTPS");
  check(parsed.pathname === "/" && !parsed.search && !parsed.hash, "target URL must be an origin root ending in /");
  origin = parsed.origin;
} catch {
  errors.push("target URL is invalid");
}

check(base.startsWith("/") && base.length > 1 && !base.endsWith("/"), "legacy base path must start with one / and have no trailing /");

const required = ["index.html", "404.html", "robots.txt"];
for (const file of required) {
  check(fs.existsSync(file) && fs.statSync(file).size > 0, `${file} must exist and be non-empty`);
}

if (errors.length === 0) {
  const pages = [["index.html", fs.readFileSync("index.html", "utf8")], ["404.html", fs.readFileSync("404.html", "utf8")]];
  for (const [name, html] of pages) {
    check(/<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']\s*\/?>/i.test(html), `${name}: robots noindex,nofollow is required`);
    check(/<meta\s+name=["']referrer["']\s+content=["']no-referrer["']\s*\/?>/i.test(html), `${name}: no-referrer policy is required`);
    check(html.includes(`<link rel="canonical" href="${target}">`), `${name}: canonical URL must be ${target}`);
    check(html.includes(`const base = "${base}";`), `${name}: legacy base must be ${base}`);
    check(html.includes("location.pathname.startsWith(base)"), `${name}: redirect must recognize the legacy base path`);
    check(html.includes("location.pathname.slice(base.length) || \"/\""), `${name}: redirect must preserve the path suffix`);
    const redirect = "location.replace(`" + origin + "${path}${location.search}${location.hash}`);";
    check(html.includes(redirect), `${name}: redirect must preserve path, query, and hash`);
    check(!/[A-Za-z]:\\(?:Users|dev)\\|\/Users\//i.test(html), `${name}: personal or stale absolute path found`);
  }
  check(pages[0][1].includes(`<meta http-equiv="refresh" content="0; url=${target}">`), `index.html: fallback refresh must target ${target}`);
  check(!/http-equiv=["']refresh["']/i.test(pages[1][1]), "404.html: refresh tag must remain absent so the script can preserve the path");
  check(fs.readFileSync("robots.txt", "utf8").replace(/\r\n/g, "\n").trim() === "User-agent: *\nDisallow: /", "robots.txt must block all crawling");
}

const result = { base, errors, status: errors.length ? "fail" : "pass", target };
console.log(JSON.stringify(result));
process.exit(errors.length ? 1 : 0);
