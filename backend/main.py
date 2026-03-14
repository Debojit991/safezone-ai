"""
SafeZone AI — YOLOv8-Pose Threat Detection Backend
FastAPI application for real-time pose estimation and threat classification.
"""

import base64
import math
import time
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO

# ─── App ───
app = FastAPI(
    title="SafeZone AI Backend",
    description="YOLOv8-Pose threat detection API",
    version="1.0.0",
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global State ───
model: Optional[YOLO] = None
start_time: float = 0.0


# ─── Models ───
class FramePayload(BaseModel):
    frame_b64: str


class UrlPayload(BaseModel):
    video_url: str


class AnalysisResult(BaseModel):
    detected_persons: int
    keypoints_raw: list
    confidence_score: float
    threat_detected: bool
    threat_type: str
    processing_ms: int


# ─── Startup ───
@app.on_event("startup")
async def load_model():
    global model, start_time
    start_time = time.time()
    model = YOLO("yolov8n-pose.pt")
    # Warm up with a dummy frame
    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    model(dummy, verbose=False)
    print("✅ YOLOv8-Pose model loaded and warmed up")


# ─── Analysis Logic ───
def analyze_frame(frame: np.ndarray) -> AnalysisResult:
    """Run YOLOv8-Pose on a single frame and classify threats."""
    t0 = time.time()
    results = model(frame, verbose=False)
    processing_ms = int((time.time() - t0) * 1000)

    detected_persons = 0
    keypoints_raw = []
    threat_detected = False
    threat_type = "NONE"
    max_confidence = 0.0

    for result in results:
        if result.keypoints is None:
            continue

        kps = result.keypoints
        # kps.data shape: (num_persons, 17, 3) — x, y, conf
        data = kps.data.cpu().numpy()

        for person_idx in range(data.shape[0]):
            detected_persons += 1
            person_kps = data[person_idx]  # (17, 3)
            keypoints_raw.append(person_kps.tolist())

            # Average keypoint confidence
            confs = person_kps[:, 2]
            avg_conf = float(np.mean(confs))
            max_confidence = max(max_confidence, avg_conf)

            # ── Collapse Detection ──
            # If any keypoint confidence is below 0.3
            low_conf_keypoints = np.sum(confs < 0.3)
            if low_conf_keypoints > 5:
                threat_detected = True
                threat_type = "PERSON_COLLAPSE"

            # ── Posture Analysis ──
            # Keypoint indices (COCO): 5=L-shoulder, 6=R-shoulder, 11=L-hip, 12=R-hip
            l_shoulder = person_kps[5]
            r_shoulder = person_kps[6]
            l_hip = person_kps[11]
            r_hip = person_kps[12]

            # Check if keypoints are detected with sufficient confidence
            if all(kp[2] > 0.3 for kp in [l_shoulder, r_shoulder, l_hip, r_hip]):
                # Center of gravity = midpoint between hips
                cog_x = (l_hip[0] + r_hip[0]) / 2
                cog_y = (l_hip[1] + r_hip[1]) / 2

                # Shoulder midpoint
                shoulder_mid_x = (l_shoulder[0] + r_shoulder[0]) / 2
                shoulder_mid_y = (l_shoulder[1] + r_shoulder[1]) / 2

                # Posture angle (angle from vertical)
                dx = shoulder_mid_x - cog_x
                dy = shoulder_mid_y - cog_y
                posture_angle = abs(math.degrees(math.atan2(dx, -dy)))

                # If person is leaning more than 45 degrees = potential collapse
                if posture_angle > 45:
                    threat_detected = True
                    if threat_type == "NONE":
                        threat_type = "ABNORMAL_POSTURE"

            # ── Aggressive Movement Detection ──
            # Check for raised arms: wrists above shoulders
            l_wrist = person_kps[9]
            r_wrist = person_kps[10]
            if l_wrist[2] > 0.3 and l_shoulder[2] > 0.3:
                if l_wrist[1] < l_shoulder[1] - 30:  # wrist significantly above shoulder
                    threat_detected = True
                    if threat_type == "NONE":
                        threat_type = "AGGRESSIVE_POSTURE"
            if r_wrist[2] > 0.3 and r_shoulder[2] > 0.3:
                if r_wrist[1] < r_shoulder[1] - 30:
                    threat_detected = True
                    if threat_type == "NONE":
                        threat_type = "AGGRESSIVE_POSTURE"

    return AnalysisResult(
        detected_persons=detected_persons,
        keypoints_raw=keypoints_raw,
        confidence_score=round(max_confidence, 4),
        threat_detected=threat_detected,
        threat_type=threat_type,
        processing_ms=processing_ms,
    )


def decode_frame_from_bytes(raw: bytes) -> np.ndarray:
    """Decode raw image bytes into an OpenCV BGR frame."""
    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image")
    return frame


# ─── Endpoints ───
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "uptime_seconds": int(time.time() - start_time),
    }


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: Optional[UploadFile] = File(None),
    payload: Optional[FramePayload] = None,
):
    """
    Analyze a frame for threats.
    Accepts either:
    - Multipart form upload (file field)
    - JSON body with base64-encoded frame (frame_b64 field)
    """
    if file is not None:
        raw = await file.read()
        frame = decode_frame_from_bytes(raw)
    elif payload is not None:
        raw = base64.b64decode(payload.frame_b64)
        frame = decode_frame_from_bytes(raw)
    else:
        return AnalysisResult(
            detected_persons=0,
            keypoints_raw=[],
            confidence_score=0.0,
            threat_detected=False,
            threat_type="NO_INPUT",
            processing_ms=0,
        )

    return analyze_frame(frame)


@app.post("/analyze-url", response_model=AnalysisResult)
async def analyze_url(payload: UrlPayload):
    """
    Download the first frame from a video URL and analyze it.
    """
    cap = cv2.VideoCapture(payload.video_url)
    if not cap.isOpened():
        return AnalysisResult(
            detected_persons=0,
            keypoints_raw=[],
            confidence_score=0.0,
            threat_detected=False,
            threat_type="VIDEO_OPEN_FAILED",
            processing_ms=0,
        )

    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        return AnalysisResult(
            detected_persons=0,
            keypoints_raw=[],
            confidence_score=0.0,
            threat_detected=False,
            threat_type="FRAME_READ_FAILED",
            processing_ms=0,
        )

    return analyze_frame(frame)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
