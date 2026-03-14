"""
SafeZone AI — Offline Keypoint Extraction
Runs YOLOv8-Pose on every 5th frame of each video in public/videos
and saves normalized keypoints as JSON fallback files.
"""

import cv2
import json
import os

import numpy as np
from ultralytics import YOLO


def extract_all():
    model = YOLO("yolov8n-pose.pt")

    video_dir = os.path.join(os.path.dirname(__file__), "..", "public", "videos")
    output_dir = os.path.join(os.path.dirname(__file__), "..", "public", "fallbacks")
    os.makedirs(output_dir, exist_ok=True)

    video_dir = os.path.abspath(video_dir)
    output_dir = os.path.abspath(output_dir)

    for filename in sorted(os.listdir(video_dir)):
        if not filename.lower().endswith(".mp4"):
            continue

        filepath = os.path.join(video_dir, filename)
        cap = cv2.VideoCapture(filepath)

        if not cap.isOpened():
            print(f"⚠️  Could not open {filename}, skipping")
            continue

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        results_list = []

        print(f"Processing {filename} — {total_frames} frames @ {fps:.1f} fps")

        for frame_idx in range(0, total_frames, 5):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            detections = model(frame, conf=0.25, verbose=False)

            for result in detections:
                if result.keypoints is None:
                    continue

                kps_data = result.keypoints.data.cpu().numpy()
                if kps_data.shape[0] == 0:
                    continue

                # Extract first person only
                person_kps = kps_data[0]  # shape (17, 3)
                h, w = frame.shape[:2]

                keypoints = []
                for kp_idx in range(17):
                    x_raw = float(person_kps[kp_idx][0])
                    y_raw = float(person_kps[kp_idx][1])
                    conf = float(person_kps[kp_idx][2])

                    keypoints.append({
                        "x": round(x_raw / w, 4) if w > 0 else 0.0,
                        "y": round(y_raw / h, 4) if h > 0 else 0.0,
                        "confidence": round(conf, 4),
                    })

                person_dict = {
                    "keypoints": keypoints,
                    "frame_time": round(frame_idx / fps, 3),
                }

                results_list.append(person_dict)
                break  # first person only per frame

        cap.release()

        # Save JSON
        video_stem = os.path.splitext(filename)[0].replace(" ", "_")
        out_path = os.path.join(output_dir, f"{video_stem}_keypoints.json")

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results_list, f, indent=2)

        print(f"✅ {filename} — {len(results_list)} keypoint frames saved to {out_path}")

    print("\n🎉 All videos processed.")


if __name__ == "__main__":
    extract_all()
