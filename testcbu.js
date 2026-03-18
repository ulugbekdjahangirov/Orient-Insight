const https = require("https");
const req = https.get("https://cbu.uz/oz/arkhiv-kursov-valyut/json/USD/", r => {
  let b = "";
  r.on("data", c => b += c);
  r.on("end", () => { try { console.log("Rate:", JSON.parse(b)[0].Rate); } catch(e){ console.error("Parse error:", e.message, b.substring(0,100)); } });
});
req.on("error", e => console.error("Request error:", e.message));
req.setTimeout(5000, () => { console.error("Timeout"); req.destroy(); });
