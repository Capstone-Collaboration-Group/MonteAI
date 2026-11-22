import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { demoConfig } from "./config.js";

const $ = (selector) => document.querySelector(selector);
const auth = getAuth(initializeApp(demoConfig.firebase));
const video = $("#camera");
const canvas = $("#capture-buffer");
const guide = $("#guide");
const status = $("#status");
let stream = null;
let guidePixels = null;
let pending = false;

function setStatus(message, kind = "") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function clearCapture() {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 1;
  canvas.height = 1;
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  guidePixels = null;
  clearCapture();
  $("#camera-panel").hidden = true;
  $("#capture").disabled = true;
}

function positionGuide() {
  if (!video.videoWidth || !video.videoHeight) return;
  const cardRatio = 720 / 1120;
  let height = video.videoHeight * 0.88;
  let width = height * cardRatio;
  if (width > video.videoWidth * 0.88) {
    width = video.videoWidth * 0.88;
    height = width / cardRatio;
  }
  guidePixels = {
    x: (video.videoWidth - width) / 2,
    y: (video.videoHeight - height) / 2,
    width,
    height,
  };
  guide.style.left = `${(guidePixels.x / video.videoWidth) * 100}%`;
  guide.style.top = `${(guidePixels.y / video.videoHeight) * 100}%`;
  guide.style.width = `${(guidePixels.width / video.videoWidth) * 100}%`;
  guide.style.height = `${(guidePixels.height / video.videoHeight) * 100}%`;
  $("#capture").disabled = false;
}

async function startCamera() {
  stopCamera();
  $("#camera-panel").hidden = false;
  setStatus("Requesting camera access…");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    positionGuide();
    setStatus("Camera ready.");
  } catch {
    stopCamera();
    setStatus("Camera access failed. Use HTTPS or localhost and grant camera permission.", "error");
  }
}

function canvasBlob() {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Capture encoding failed"))),
      "image/jpeg",
      0.9,
    );
  });
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const encoded = btoa(binary);
  binary = "";
  return encoded;
}

async function verifyCapture() {
  if (pending || !guidePixels || !auth.currentUser) return;
  pending = true;
  $("#capture").disabled = true;
  $("#receipt").hidden = true;
  let bytes = null;
  let encoded = "";
  try {
    await reload(auth.currentUser);
    if (!auth.currentUser.emailVerified) throw new Error("Verify your Firebase email first.");
    const token = await auth.currentUser.getIdToken(true);
    canvas.width = 720;
    canvas.height = 1120;
    canvas.getContext("2d").drawImage(
      video,
      guidePixels.x,
      guidePixels.y,
      guidePixels.width,
      guidePixels.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    bytes = new Uint8Array(await (await canvasBlob()).arrayBuffer());
    encoded = encodeBase64(bytes);
    setStatus("Verifying…");
    const response = await fetch(demoConfig.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        student: {
          studentNumber: $("#student-number").value,
          firstName: $("#first-name").value,
          middleInitial: $("#middle-initial").value,
          lastName: $("#last-name").value,
          suffix: $("#suffix").value,
        },
        imageBase64: encoded,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Verification failed.");
    stopCamera();
    setStatus("ID verified. The receipt is ready for registration.", "success");
    // Display only for this local demo. Production clients pass it directly to
    // /auth/register and must not put it in localStorage, logs, or analytics.
    $("#receipt").textContent = result.receipt;
    $("#receipt").hidden = false;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Verification failed.", "error");
  } finally {
    bytes?.fill(0);
    bytes = null;
    encoded = "";
    clearCapture();
    pending = false;
    if (stream) $("#capture").disabled = false;
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Signing in…");
  try {
    await signInWithEmailAndPassword(auth, $("#email").value, $("#password").value);
    $("#password").value = "";
  } catch {
    $("#password").value = "";
    setStatus("Sign-in failed.", "error");
  }
});

$("#sign-out").addEventListener("click", async () => {
  stopCamera();
  $("#receipt").textContent = "";
  $("#receipt").hidden = true;
  await signOut(auth);
});
$("#identity-form").addEventListener("submit", (event) => {
  event.preventDefault();
  startCamera();
});
$("#capture").addEventListener("click", verifyCapture);
$("#cancel").addEventListener("click", () => {
  stopCamera();
  setStatus("Capture cancelled and discarded.");
});
video.addEventListener("loadedmetadata", positionGuide);
window.addEventListener("pagehide", stopCamera);

onAuthStateChanged(auth, (user) => {
  stopCamera();
  $("#login-form").hidden = Boolean(user);
  $("#session").hidden = !user;
  $("#identity-panel").hidden = !user;
  $("#session-email").textContent = user?.email || "";
  setStatus(user ? "Signed in. Confirm your details." : "Sign in with an existing test account.");
});
