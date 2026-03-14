# SafeZone AI — YOLOv8-Pose Backend

Real-time pose estimation and threat detection API powered by YOLOv8-Pose and FastAPI.

## Local Development

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Server starts at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

## Docker

```bash
cd backend
docker build -t safezone-backend .
docker run -p 8000:8000 safezone-backend
```

## Deploy to Render.com

1. Create a **New Web Service** on [render.com](https://render.com)
2. Connect your GitHub repository
3. Configure:
   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `backend` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port 8000` |
   | **Environment** | Python 3 |

4. Set environment variables:
   - `GOOGLE_APPLICATION_CREDENTIALS` — path to Firebase Admin SDK JSON (for RTDB writes)

5. Deploy — the YOLOv8 model (`yolov8n-pose.pt`) downloads automatically on first startup.

## API Endpoints

### `GET /health`
Returns server status, model load state, and uptime.

### `POST /analyze`
Accepts multipart file upload or JSON `{ "frame_b64": "..." }`. Returns threat analysis.

### `POST /analyze-url`
Accepts JSON `{ "video_url": "..." }`. Downloads first frame and analyzes.

### Response Schema
```json
{
  "detected_persons": 2,
  "keypoints_raw": [...],
  "confidence_score": 0.91,
  "threat_detected": true,
  "threat_type": "ABNORMAL_POSTURE",
  "processing_ms": 340
}
```
