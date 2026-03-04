const net = require("net");
const socket = new net.Socket();
socket.setTimeout(3000);
socket.on("error", (err) => { console.log("ERROR:", err.message); process.exit(1); });
socket.on("timeout", () => { console.log("TIMEOUT"); process.exit(1); });
socket.on("data", (data) => { console.log("DATA:", data.toString()); socket.destroy(); });
socket.connect(25, "gmail-smtp-in.l.google.com", () => { console.log("CONNECTED"); });
