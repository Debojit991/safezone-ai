"""
SafeZone AI — YOLOv8-Pose Threat Detection Backend
FastAPI application for real-time pose estimation and threat classification.
"""

import base64
import math
import time
from typing import List, Optional

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
fire_model: Optional[YOLO] = None
start_time: float = 0.0
latest_frame_result: dict = {}


# ─── Response Models ───
class KeypointNormalized(BaseModel):
    x: float
    y: float
    confidence: float


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class PersonDetection(BaseModel):
    keypoints_normalized: List[KeypointNormalized]
    bounding_box: BoundingBox


class AnalysisResult(BaseModel):
    detected_persons: int
    keypoints_raw: list
    keypoints_normalized: List[List[KeypointNormalized]]
    persons: List[PersonDetection]
    frame_width: int
    frame_height: int
    confidence_score: float
    threat_detected: bool
    threat_type: str
    processing_ms: int
    fire_detected: bool = False
    smoke_detected: bool = False


class FramePayload(BaseModel):
    frame_b64: str


class UrlPayload(BaseModel):
    video_url: str


class FrameRequest(BaseModel):
    image_base64: str


def _empty_result(threat_type: str = "NONE", processing_ms: int = 0) -> AnalysisResult:
    """Return an empty AnalysisResult with the given threat_type."""
    return AnalysisResult(
        detected_persons=0,
        keypoints_raw=[],
        keypoints_normalized=[],
        persons=[],
        frame_width=0,
        frame_height=0,
        confidence_score=0.0,
        threat_detected=False,
        threat_type=threat_type,
        processing_ms=processing_ms,
        fire_detected=False,
        smoke_detected=False,
    )


# ─── Startup ───
@app.on_event("startup")
async def load_model():
    global model, fire_model, start_time
    start_time = time.time()
    model = YOLO("yolov8n-pose.pt")
    fire_model = YOLO("yolov8n.pt")
    # Warm up with a dummy frame
    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    model(dummy, verbose=False)
    fire_model(dummy, verbose=False)
    print("✅ YOLOv8-Pose + fire detection models loaded and warmed up")


def detect_fire_smoke(frame: np.ndarray) -> dict:
    """
    Detect fire/smoke by analyzing HSV pixel distribution with strict filtering.
    - Tight HSV thresholds to exclude clothing/skin (hue 5-25, sat>180, val>220)
    - Exclusion zone: ignore center 60% of frame (person body area)
    - Only count fire in upper 40% of frame OR outer 20% edges
    - Average brightness of fire pixels must exceed 220
    - fire_detected  = fire pixels > 15% of eligible zone
    - smoke_detected = fire pixels > 10% of eligible zone
    """
    frame_h, frame_w = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h_ch, s_ch, v_ch = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    # Tight fire color mask — excludes pure red (clothing) and dark tones (skin)
    color_mask = (h_ch >= 5) & (h_ch <= 25) & (s_ch > 180) & (v_ch > 220)

    # Exclusion zone mask — only keep pixels in:
    #   - Upper 40% of frame (y < 0.4 * height) — fire rises above people
    #   - Outer 20% edges (x < 0.2 * width OR x > 0.8 * width)
    y_coords = np.arange(frame_h).reshape(-1, 1)
    x_coords = np.arange(frame_w).reshape(1, -1)
    upper_zone = y_coords < (0.4 * frame_h)
    left_edge = x_coords < (0.2 * frame_w)
    right_edge = x_coords > (0.8 * frame_w)
    eligible_mask = upper_zone | left_edge | right_edge

    # Combine: fire color in eligible zones only
    fire_mask = color_mask & eligible_mask
    eligible_pixel_count = int(np.sum(eligible_mask))
    fire_pixel_count = int(np.sum(fire_mask))

    # Average brightness check — actual flames are extremely bright
    if fire_pixel_count > 0:
        avg_brightness = float(np.mean(v_ch[fire_mask]))
    else:
        avg_brightness = 0.0

    fire_ratio = fire_pixel_count / eligible_pixel_count if eligible_pixel_count > 0 else 0.0

    # Fire requires bright pixels (avg > 220) AND sufficient coverage
    is_fire = fire_ratio > 0.15 and avg_brightness > 220
    is_smoke = fire_ratio > 0.10 and avg_brightness > 220

    return {
        "fire_detected": is_fire,
        "smoke_detected": is_smoke,
        "fire_pixel_ratio": round(fire_ratio, 4),
    }


# ─── Analysis Logic ───
def analyze_frame(frame: np.ndarray) -> AnalysisResult:
    """Run YOLOv8-Pose on a single frame and classify threats."""
    t0 = time.time()
    results = model(frame, verbose=False)
    processing_ms = int((time.time() - t0) * 1000)

    h, w = frame.shape[:2]
    detected_persons = 0
    keypoints_raw: list = []
    keypoints_normalized: List[List[KeypointNormalized]] = []
    persons: List[PersonDetection] = []
    bounding_boxes: list = []  # track for overlap detection
    threat_detected = False
    threat_type = "NONE"
    max_confidence = 0.0
    cog_below_threshold = False

    for result in results:
        if result.keypoints is None:
            continue

        kps = result.keypoints
        # kps.data shape: (num_persons, 17, 3) — x, y, conf
        data = kps.data.cpu().numpy()

        # Get bounding boxes if available
        boxes_data = None
        if result.boxes is not None:
            boxes_data = result.boxes.xyxy.cpu().numpy()

        for person_idx in range(data.shape[0]):
            detected_persons += 1
            person_kps = data[person_idx]  # (17, 3)
            keypoints_raw.append(person_kps.tolist())

            # Build normalized keypoints for this person
            person_kps_norm: List[KeypointNormalized] = []
            for kp in person_kps:
                person_kps_norm.append(KeypointNormalized(
                    x=round(float(kp[0]) / w, 4) if w > 0 else 0.0,
                    y=round(float(kp[1]) / h, 4) if h > 0 else 0.0,
                    confidence=round(float(kp[2]), 4),
                ))
            keypoints_normalized.append(person_kps_norm)

            # Build bounding box (from YOLO boxes or from keypoint extremes)
            if boxes_data is not None and person_idx < len(boxes_data):
                bx1, by1, bx2, by2 = boxes_data[person_idx]
                bbox = BoundingBox(
                    x=round(float(bx1) / w, 4),
                    y=round(float(by1) / h, 4),
                    width=round(float(bx2 - bx1) / w, 4),
                    height=round(float(by2 - by1) / h, 4),
                )
                bounding_boxes.append((float(bx1), float(by1), float(bx2), float(by2)))
            else:
                # Fallback: compute from visible keypoints
                visible = person_kps[person_kps[:, 2] > 0.3]
                if len(visible) > 0:
                    x_min, y_min = visible[:, 0].min(), visible[:, 1].min()
                    x_max, y_max = visible[:, 0].max(), visible[:, 1].max()
                    bbox = BoundingBox(
                        x=round(float(x_min) / w, 4),
                        y=round(float(y_min) / h, 4),
                        width=round(float(x_max - x_min) / w, 4),
                        height=round(float(y_max - y_min) / h, 4),
                    )
                    bounding_boxes.append((float(x_min), float(y_min), float(x_max), float(y_max)))
                else:
                    bbox = BoundingBox(x=0, y=0, width=0, height=0)

            persons.append(PersonDetection(
                keypoints_normalized=person_kps_norm,
                bounding_box=bbox,
            ))

            # Average keypoint confidence
            confs = person_kps[:, 2]
            avg_conf = float(np.mean(confs))
            max_confidence = max(max_confidence, avg_conf)

            # ── Collapse Detection: low confidence keypoints ──
            low_conf_keypoints = int(np.sum(confs < 0.3))
            if low_conf_keypoints > 5:
                threat_detected = True
                if threat_type == "NONE":
                    threat_type = "PERSON_COLLAPSE"

            # ── Center of Gravity Detection ──
            # Keypoint indices (COCO): 11=L-hip, 12=R-hip
            l_hip = person_kps[11]
            r_hip = person_kps[12]
            if l_hip[2] > 0.3 and r_hip[2] > 0.3:
                cog_y_pixel = (l_hip[1] + r_hip[1]) / 2
                cog_y_norm = cog_y_pixel / h if h > 0 else 0
                if cog_y_norm > 0.7:
                    cog_below_threshold = True

            # ── Posture Analysis ──
            l_shoulder = person_kps[5]
            r_shoulder = person_kps[6]

            if all(kp[2] > 0.3 for kp in [l_shoulder, r_shoulder, l_hip, r_hip]):
                cog_x = (l_hip[0] + r_hip[0]) / 2
                cog_y_p = (l_hip[1] + r_hip[1]) / 2
                shoulder_mid_x = (l_shoulder[0] + r_shoulder[0]) / 2
                shoulder_mid_y = (l_shoulder[1] + r_shoulder[1]) / 2

                dx = shoulder_mid_x - cog_x
                dy = shoulder_mid_y - cog_y_p
                posture_angle = abs(math.degrees(math.atan2(dx, -dy)))

                if posture_angle > 45:
                    threat_detected = True
                    if threat_type == "NONE":
                        threat_type = "ABNORMAL_POSTURE"

            # ── Aggressive Movement Detection ──
            l_wrist = person_kps[9]
            r_wrist = person_kps[10]
            if l_wrist[2] > 0.3 and l_shoulder[2] > 0.3:
                if l_wrist[1] < l_shoulder[1] - 30:
                    threat_detected = True
                    if threat_type == "NONE":
                        threat_type = "AGGRESSIVE_POSTURE"
            if r_wrist[2] > 0.3 and r_shoulder[2] > 0.3:
                if r_wrist[1] < r_shoulder[1] - 30:
                    threat_detected = True
                    if threat_type == "NONE":
                        threat_type = "AGGRESSIVE_POSTURE"

    # ── High-level threat classification (overrides) ──
    if cog_below_threshold and threat_type in ("NONE", "ABNORMAL_POSTURE"):
        threat_detected = True
        threat_type = "PERSON_COLLAPSE"

    if detected_persons > 3:
        threat_detected = True
        threat_type = "CROWD_CRUSH"
    elif detected_persons >= 2:
        # Check for overlapping bounding boxes → FIGHTING
        for i in range(len(bounding_boxes)):
            for j in range(i + 1, len(bounding_boxes)):
                ax1, ay1, ax2, ay2 = bounding_boxes[i]
                bx1, by1, bx2, by2 = bounding_boxes[j]
                # Compute IoU overlap
                ix1 = max(ax1, bx1)
                iy1 = max(ay1, by1)
                ix2 = min(ax2, bx2)
                iy2 = min(ay2, by2)
                if ix1 < ix2 and iy1 < iy2:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    area_a = (ax2 - ax1) * (ay2 - ay1)
                    area_b = (bx2 - bx1) * (by2 - by1)
                    min_area = min(area_a, area_b)
                    if min_area > 0 and intersection / min_area > 0.15:
                        threat_detected = True
                        threat_type = "FIGHTING"
                        break
            if threat_type == "FIGHTING":
                break
    elif detected_persons == 1 and max_confidence > 0.5 and threat_type == "NONE":
        threat_detected = True
        threat_type = "INTRUSION"

    # Final fallback
    if threat_detected and threat_type == "NONE":
        threat_type = "GENERAL_THREAT"

    # ── Fire / Smoke Detection ──
    fire_result = detect_fire_smoke(frame)
    fire_detected = fire_result["fire_detected"]
    smoke_detected = fire_result["smoke_detected"]

    if fire_detected and threat_type in ("NONE", "GENERAL_THREAT"):
        threat_detected = True
        threat_type = "FIRE_DETECTED"
    elif smoke_detected and threat_type == "NONE":
        threat_detected = True
        threat_type = "SMOKE_DETECTED"

    return AnalysisResult(
        detected_persons=detected_persons,
        keypoints_raw=keypoints_raw,
        keypoints_normalized=keypoints_normalized,
        persons=persons,
        frame_width=w,
        frame_height=h,
        confidence_score=round(max_confidence, 4),
        threat_detected=threat_detected,
        threat_type=threat_type,
        processing_ms=processing_ms,
        fire_detected=fire_detected,
        smoke_detected=smoke_detected,
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
        return _empty_result("NO_INPUT")

    return analyze_frame(frame)


@app.post("/analyze-url", response_model=AnalysisResult)
async def analyze_url(payload: UrlPayload):
    """
    Download the first frame from a video URL and analyze it.
    """
    cap = cv2.VideoCapture(payload.video_url)
    if not cap.isOpened():
        return _empty_result("VIDEO_OPEN_FAILED")

    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        return _empty_result("FRAME_READ_FAILED")

    return analyze_frame(frame)


@app.post("/analyze-frame", response_model=AnalysisResult)
async def analyze_frame_endpoint(payload: FrameRequest):
    """
    Analyze a single base64-encoded image frame.
    """
    global latest_frame_result

    raw = base64.b64decode(payload.image_base64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if frame is None:
        return _empty_result("UNKNOWN")

    result = analyze_frame(frame)
    latest_frame_result = result.dict()
    latest_frame_result["frame_base64"] = payload.image_base64
    return result


@app.get("/live-keypoints")
async def live_keypoints():
    """
    Return the most recent frame analysis result.
    """
    if latest_frame_result:
        return latest_frame_result
    return {"message": "no frames analyzed yet"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
