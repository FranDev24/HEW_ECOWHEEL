const fs = require("fs");
const a = fs.readFileSync("admin.js", "utf8").split("\r\n").join("\n").split("\n");
const out = [];
a.forEach((l, i) => { if (i >= 471 && i <= 660) out.push(String(i + 1).padStart(4) + "| " + l); });
fs.writeFileSync("_dump.txt", out.join("\r\n"));