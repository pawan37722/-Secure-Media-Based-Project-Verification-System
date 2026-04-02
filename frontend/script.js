const API_BASE = ENV.API_BASE_URL;

// ── DOM refs ──────────────────────────────────────────────────
const photoBtn         = document.getElementById("photoBtn");
const videoBtn         = document.getElementById("videoBtn");
const cameraModal      = document.getElementById("cameraModal");
const camera           = document.getElementById("camera");
const canvas           = document.getElementById("canvas");
const captureBtn       = document.getElementById("captureBtn");
const retakeBtn        = document.getElementById("retakeBtn");
const uploadBtn        = document.getElementById("uploadBtn");
const closeBtn         = document.getElementById("closeBtn");
const uploadStatus     = document.getElementById("uploadStatus");

const urlInput         = document.getElementById("urlInput");
const loadBtn          = document.getElementById("loadBtn");
const viewImage        = document.getElementById("viewImage");
const viewVideo        = document.getElementById("viewVideo");
const errorBox         = document.getElementById("errorBox");
const metaData         = document.getElementById("metaData");
const dateText         = document.getElementById("dateText");
const timeText         = document.getElementById("timeText");
const latText          = document.getElementById("latText");
const lngText          = document.getElementById("lngText");
const locationUrlInput = document.getElementById("locationUrlInput");
const copyLocationBtn  = document.getElementById("copyLocationBtn");
const mapLink          = document.getElementById("mapLink");
const mapEmbed         = document.getElementById("mapEmbed");

let stream, capturedBlob, mode;
let mediaRecorder, chunks = [];

// ── OPEN CAMERA ───────────────────────────────────────────────
photoBtn.onclick = () => { mode = "photo"; openCamera(false); };
videoBtn.onclick = () => { mode = "video"; openCamera(true); };

async function openCamera(withAudio) {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: withAudio });
        camera.srcObject = stream;
        cameraModal.classList.remove("hidden");
        resetControls();
    } catch (err) {
        alert("Camera access denied: " + err.message);
    }
}

function resetControls() {
    captureBtn.classList.remove("hidden");
    captureBtn.innerText = mode === "photo" ? "Capture Photo" : "Start Recording";
    captureBtn.onclick = handleCapture;
    retakeBtn.classList.add("hidden");
    uploadBtn.classList.add("hidden");
    uploadStatus.classList.add("hidden");
    uploadStatus.innerHTML = "";
}

// ── CAPTURE ───────────────────────────────────────────────────
function handleCapture() {
    if (mode === "photo") capturePhoto();
    else startRecording();
}

function capturePhoto() {
    canvas.width  = camera.videoWidth;
    canvas.height = camera.videoHeight;
    canvas.getContext("2d").drawImage(camera, 0, 0);
    canvas.toBlob(blob => { capturedBlob = blob; showOptions(); }, "image/jpeg");
}

function startRecording() {
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.start();
    captureBtn.innerText = "⏹ Stop Recording";
    captureBtn.onclick = stopRecording;
}

function stopRecording() {
    mediaRecorder.stop();
    mediaRecorder.onstop = () => {
        capturedBlob = new Blob(chunks, { type: "video/webm" });
        showOptions();
    };
}

function showOptions() {
    captureBtn.classList.add("hidden");
    retakeBtn.classList.remove("hidden");
    uploadBtn.classList.remove("hidden");
}

retakeBtn.onclick = () => resetControls();
closeBtn.onclick  = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    cameraModal.classList.add("hidden");
};

// ── UPLOAD ────────────────────────────────────────────────────
uploadBtn.onclick = async () => {
    uploadBtn.disabled  = true;
    uploadBtn.innerText = "Uploading…";

    try {
        const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );

        const now = new Date();
        const ext = mode === "photo" ? "capture.jpg" : "capture.webm";

        const fd = new FormData();
        fd.append("file",      capturedBlob, ext);
        fd.append("latitude",  pos.coords.latitude);
        fd.append("longitude", pos.coords.longitude);
        fd.append("date",      now.toISOString().split("T")[0]);
        fd.append("time",      now.toTimeString().split(" ")[0]);

        const res  = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        // Show result with verify URL and the location URL saved in DB
        uploadStatus.classList.remove("hidden");
        uploadStatus.innerHTML = `
            <div class="upload-success">
                ✅ <strong>Uploaded &amp; saved to database!</strong>

                <div class="result-row">
                    <span class="result-label">🔗 Verification URL</span>
                    <div class="url-copy-row">
                        <input type="text" value="${data.verify_url}" readonly id="verifyUrlOut">
                        <button onclick="copyText('verifyUrlOut', this)">📋 Copy</button>
                        <a href="${data.verify_url}" target="_blank">Open</a>
                    </div>
                </div>

                <div class="result-row">
                    <span class="result-label">📍 Location URL (saved in DB)</span>
                    <div class="url-copy-row">
                        <input type="text" value="${data.location_url || 'Location not available'}" readonly id="locUrlOut">
                        <button onclick="copyText('locUrlOut', this)">📋 Copy</button>
                        ${data.location_url ? `<a href="${data.location_url}" target="_blank">Open Map</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        alert("Upload error: " + err.message);
    } finally {
        uploadBtn.disabled  = false;
        uploadBtn.innerText = "Upload & Get Link";
    }
};

function copyText(inputId, btn) {
    const val = document.getElementById(inputId).value;
    navigator.clipboard.writeText(val)
        .then(() => { btn.innerText = "✅ Copied!"; setTimeout(() => btn.innerText = "📋 Copy", 2000); })
        .catch(() => alert("Copy failed"));
}

// ── LOAD / VIEW ───────────────────────────────────────────────
loadBtn.onclick = async () => {
    const input = urlInput.value.trim();
    if (!input) { showError("Please enter a verification URL or ID."); return; }

    let id = input;
    try {
        const parsed = new URL(input);
        id = parsed.searchParams.get("id") || input;
    } catch (_) { /* raw ID */ }

    errorBox.classList.add("hidden");
    viewImage.classList.add("hidden");
    viewVideo.classList.add("hidden");
    metaData.classList.add("hidden");
    loadBtn.innerText = "Loading…";

    try {
        const res  = await fetch(`${API_BASE}/media-info/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Not found");

        // Media
        if (data.file_type === "image") {
            viewImage.src = data.file_url;
            viewImage.classList.remove("hidden");
        } else {
            viewVideo.src = data.file_url;
            viewVideo.classList.remove("hidden");
        }

        // Date & Time
        dateText.innerText = data.capture_date || "—";
        timeText.innerText = data.capture_time || "—";

        // Lat / Lng
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        latText.innerText = !isNaN(lat) ? lat.toFixed(6) : "—";
        lngText.innerText = !isNaN(lng) ? lng.toFixed(6) : "—";

        // ✅ Location URL — read directly from DB field, not rebuilt
        const locUrl = data.location_url;

        if (locUrl) {
            locationUrlInput.value = locUrl;
            mapLink.href           = locUrl;
            mapLink.style.display  = "";

            copyLocationBtn.onclick = () => {
                navigator.clipboard.writeText(locUrl)
                    .then(() => {
                        copyLocationBtn.innerText = "✅ Copied!";
                        setTimeout(() => copyLocationBtn.innerText = "📋 Copy", 2000);
                    })
                    .catch(() => alert("Copy failed"));
            };

            // Embedded OpenStreetMap pin (no API key needed)
            mapEmbed.src = `https://www.openstreetmap.org/export/embed.html`
                         + `?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}`
                         + `&layer=mapnik&marker=${lat},${lng}`;
        } else {
            locationUrlInput.value = "Location not available";
            mapLink.style.display  = "none";
            mapEmbed.src           = "";
        }

        metaData.classList.remove("hidden");

    } catch (err) {
        showError("Error: " + err.message);
    } finally {
        loadBtn.innerText = "Load";
    }
};

function showError(msg) {
    errorBox.innerText = msg;
    errorBox.classList.remove("hidden");
}

// Auto-load on ?id= in URL
window.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) { urlInput.value = id; loadBtn.click(); }
});