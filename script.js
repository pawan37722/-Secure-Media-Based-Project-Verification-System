let stream;
let capturedBlob;
let mode = "";
let mediaRecorder;
let chunks = [];

// BUTTONS
const photoBtn = document.getElementById("photoBtn");
const videoBtn = document.getElementById("videoBtn");

const cameraModal = document.getElementById("cameraModal");
const video = document.getElementById("camera");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const uploadBtn = document.getElementById("uploadBtn");
const closeBtn = document.getElementById("closeBtn");

// VIEW ELEMENTS
const loadBtn = document.getElementById("loadBtn");

// ================= PHOTO =================
photoBtn.onclick = () => {
    mode = "photo";
    openCamera(false);
};

// ================= VIDEO =================
videoBtn.onclick = () => {
    mode = "video";
    openCamera(true);
};

// ================= OPEN CAMERA =================
async function openCamera(withAudio) {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: withAudio
        });

        video.srcObject = stream;
        cameraModal.classList.remove("hidden");

        resetUI();
    } catch (err) {
        alert("Camera permission denied");
    }
}

// ================= CAPTURE =================
captureBtn.onclick = () => {
    if (mode === "photo") capturePhoto();
    else startRecording();
};

// ================= PHOTO CAPTURE =================
function capturePhoto() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        capturedBlob = blob;
        showAfterCapture();
    });
}

// ================= VIDEO RECORD START =================
function startRecording() {
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => chunks.push(e.data);

    mediaRecorder.start();

    captureBtn.innerText = "Stop";
    captureBtn.onclick = stopRecording;
}

// ================= VIDEO RECORD STOP =================
function stopRecording() {
    mediaRecorder.stop();

    mediaRecorder.onstop = () => {
        capturedBlob = new Blob(chunks, { type: "video/webm" });
        showAfterCapture();
    };
}

// ================= AFTER CAPTURE =================
function showAfterCapture() {
    captureBtn.classList.add("hidden");
    retakeBtn.classList.remove("hidden");
    uploadBtn.classList.remove("hidden");
}

// ================= RETAKE =================
retakeBtn.onclick = () => {
    capturedBlob = null;
    resetUI();
};

// ================= CLOSE CAMERA =================
closeBtn.onclick = closeCamera;

function closeCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    cameraModal.classList.add("hidden");
}

// ================= RESET UI =================
function resetUI() {
    captureBtn.classList.remove("hidden");
    retakeBtn.classList.add("hidden");
    uploadBtn.classList.add("hidden");

    captureBtn.innerText = "Capture";
    captureBtn.onclick = () => {
        if (mode === "photo") capturePhoto();
        else startRecording();
    };
}

// ================= GET LOCATION =================
function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

// ================= UPLOAD =================
uploadBtn.onclick = async () => {
    if (!capturedBlob) return;

    await uploadFile(
        capturedBlob,
        mode === "photo" ? "photo.png" : "video.webm"
    );

    closeCamera();
};

async function uploadFile(file, name) {
    try {
        const pos = await getLocation();

        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        const now = new Date();

        const date = now.toISOString().split("T")[0];
        const time = now.toTimeString().split(" ")[0];

        const formData = new FormData();
        formData.append("file", file, name);
        formData.append("latitude", latitude);
        formData.append("longitude", longitude);
        formData.append("date", date);
        formData.append("time", time);

        const res = await fetch(ENV.API_URL, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        alert("Uploaded URL: " + (data.url || "No URL returned"));

    } catch (err) {
        console.error(err);
        alert("Upload failed");
    }
}

// ================= VIEW URL =================
loadBtn.onclick = async () => {
    const url = document.getElementById("urlInput").value;

    const img = document.getElementById("viewImage");
    const vid = document.getElementById("viewVideo");

    img.classList.add("hidden");
    vid.classList.add("hidden");

    if (!url) return alert("Enter URL");

    try {
        // Call backend to fetch metadata
        const res = await fetch(`${ENV.API_URL}?url=${encodeURIComponent(url)}`);
        const data = await res.json();

        // SHOW MEDIA
        if (data.type === "image") {
            img.src = data.url;
            img.classList.remove("hidden");
        } else {
            vid.src = data.url;
            vid.classList.remove("hidden");
        }

        // SHOW METADATA
        showMetaData(data);

        // AUTO SCROLL TO MEDIA
        document.querySelector(".left").scrollIntoView({ behavior: "smooth" });

    } catch (err) {
        console.error(err);
        alert("Failed to load media");
    }
};

// ================= SHOW METADATA =================
function showMetaData(data) {
    const meta = document.getElementById("metaData");

    document.getElementById("dateText").innerText =
        "📅 Date: " + data.date;

    document.getElementById("timeText").innerText =
        "⏰ Time: " + data.time;

    document.getElementById("locationText").innerText =
        "📍 Lat: " + data.latitude + ", Lng: " + data.longitude;

    const mapUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;

    const link = document.getElementById("mapLink");
    link.href = mapUrl;
    link.innerText = "Open in Google Maps";

    meta.classList.remove("hidden");
}