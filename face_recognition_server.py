"""
Face Recognition & Live RTSP Stream Server with Pre/Post Buffered Clip Recording
Port: 8090

WebSocket Endpoint:
  ws://<SERVER_IP>:8090/face/ws?rtsp_url=<URL_ENCODED_RTSP_URL>

HTTP Endpoints:
  POST http://<SERVER_IP>:8090/faces/reload
  GET  http://<SERVER_IP>:8090/health

Payload Specification:
1. Frame message:
   { "type": "frame", "frame": "<base64 JPEG>" }

2. Instant Detection message:
   {
     "type": "detection",
     "detection_id": "<uuid>",
     "emp_id": "<criminal_code_or_id>",
     "match_percentage": 87.45,
     "face_image": "<base64 JPEG>",
     "snapshot": "<base64 JPEG>",
     "clip_incoming": true,
     "clip_eta_seconds": 4.0
   }

3. Clip message (~4s later):
   {
     "type": "detection_clip",
     "detection_id": "<matching_uuid>",
     "emp_id": "<criminal_code_or_id>",
     "match_percentage": 87.45,
     "clip_duration_seconds": 7.15,
     "clip_mime": "video/mp4",
     "clip_base64": "<base64 MP4 bytes>"
   }
"""

import os
import sys
import time
import uuid
import base64
import asyncio
import tempfile
import threading
from collections import deque
from typing import Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ==============================================================================
# Tuning Knobs & Configuration
# ==============================================================================
CLIP_PRE_SECONDS = 3.0       # Seconds of video before detection
CLIP_POST_SECONDS = 4.0      # Seconds of video after detection (~7s total)
ASSUMED_CAMERA_FPS = 15.0    # Frame rate for buffer calculation and MP4 export
FRAME_STREAM_FPS = 15.0      # Frame rate sent to browser WebSocket
COOLDOWN_SECONDS = 60.0      # 1 minute cooldown per detected person
SIMILARITY_THRESHOLD = 0.50  # Face match confidence threshold (50%+)
FRAME_WIDTH = 640
FRAME_HEIGHT = 360

PRE_BUFFER_SIZE = int(CLIP_PRE_SECONDS * ASSUMED_CAMERA_FPS)
POST_BUFFER_SIZE = int(CLIP_POST_SECONDS * ASSUMED_CAMERA_FPS)

app = FastAPI(title="Face Recognition & Live Stream AI Server", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active recognizer / stream tracker
active_recognizers: Dict[str, dict] = {}
active_recognizers_lock = threading.Lock()

# Face Database (in-memory embeddings)
face_db: Dict[str, dict] = {}
face_db_lock = threading.Lock()

# Load OpenCV Cascade / DNN Face Detector as fallback or primary
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def load_known_faces():
    """
    Loads known face images or embeddings from 'known_faces' folder or database.
    """
    global face_db
    known_dir = os.path.join(os.path.dirname(__file__), "known_faces")
    if not os.path.exists(known_dir):
        os.makedirs(known_dir, exist_ok=True)

    loaded = {}
    for filename in os.listdir(known_dir):
        if filename.lower().endswith((".jpg", ".jpeg", ".png")):
            emp_id = os.path.splitext(filename)[0]
            img_path = os.path.join(known_dir, filename)
            img = cv2.imread(img_path)
            if img is not None:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, 1.2, 4)
                if len(faces) > 0:
                    x, y, w, h = faces[0]
                    face_roi = cv2.resize(gray[y:y+h, x:x+w], (100, 100))
                    loaded[emp_id] = {
                        "emp_id": emp_id,
                        "template": face_roi,
                        "filename": filename,
                        "loaded_at": time.time()
                    }
                else:
                    resized = cv2.resize(gray, (100, 100))
                    loaded[emp_id] = {
                        "emp_id": emp_id,
                        "template": resized,
                        "filename": filename,
                        "loaded_at": time.time()
                    }

    with face_db_lock:
        face_db = loaded
    print(f"✅ Loaded {len(loaded)} known faces into memory.")


# Initialize known faces on startup
load_known_faces()


def encode_frames_to_mp4(frames: List[np.ndarray], fps: float = 15.0) -> Optional[bytes]:
    """
    Encodes a list of BGR numpy image frames into an MP4 video file in memory.
    """
    if not frames:
        return None

    h, w = frames[0].shape[:2]
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_file:
            tmp_path = tmp_file.name

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(tmp_path, fourcc, fps, (w, h))

        for frame in frames:
            if frame.shape[:2] != (h, w):
                frame = cv2.resize(frame, (w, h))
            writer.write(frame)
        writer.release()

        with open(tmp_path, "rb") as f:
            mp4_bytes = f.read()

        return mp4_bytes
    except Exception as e:
        print(f"❌ Error encoding MP4 clip: {e}")
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


def match_face(gray_face: np.ndarray) -> Optional[tuple]:
    """
    Matches detected face against face_db.
    Returns (emp_id, match_percentage, matched_template) or None.
    """
    with face_db_lock:
        if not face_db:
            return None

        best_score = -1.0
        best_id = None
        resized_query = cv2.resize(gray_face, (100, 100))

        for emp_id, record in face_db.items():
            template = record["template"]
            # Normalized correlation coefficient
            res = cv2.matchTemplate(resized_query, template, cv2.TM_CCOEFF_NORMED)
            score = float(res[0][0])
            if score > best_score:
                best_score = score
                best_id = emp_id

        if best_score >= SIMILARITY_THRESHOLD and best_id:
            match_pct = round(min(best_score * 100, 99.8), 2)
            return (best_id, match_pct)

    return None


# ==============================================================================
# Health Check Endpoint
# ==============================================================================
@app.get("/health")
def health():
    """
    Health check / uptime monitoring endpoint
    """
    with active_recognizers_lock:
        count = len(active_recognizers)
    with face_db_lock:
        faces_count = len(face_db)

    return {
        "status": "ok",
        "active_recognizers": count,
        "known_faces_loaded": faces_count,
        "clip_pre_seconds": CLIP_PRE_SECONDS,
        "clip_post_seconds": CLIP_POST_SECONDS,
        "assumed_camera_fps": ASSUMED_CAMERA_FPS,
        "timestamp": time.time()
    }


# ==============================================================================
# Reload Face Database Endpoint
# ==============================================================================
@app.post("/faces/reload")
def reload_faces():
    """
    Reloads face database from directory after new registration
    """
    try:
        load_known_faces()
        with face_db_lock:
            count = len(face_db)
        return {
            "status": "success",
            "message": f"Successfully reloaded face database. Total faces: {count}",
            "faces_loaded": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# WebSocket Live Stream & Detection Intercept Endpoint
# ==============================================================================
@app.websocket("/face/ws")
async def face_ws_endpoint(websocket: WebSocket, rtsp_url: str):
    """
    Live video stream + detection alerts + MP4 clips
    Endpoint: ws://<SERVER_IP>:8090/face/ws?rtsp_url=<RTSP_URL>
    """
    await websocket.accept()

    stream_id = str(uuid.uuid4())
    print(f"🔌 [WS Connected] Stream ID: {stream_id} | RTSP: {rtsp_url}")

    with active_recognizers_lock:
        active_recognizers[stream_id] = {
            "rtsp_url": rtsp_url,
            "connected_at": time.time()
        }

    # Circular buffer for pre-detection frames (3.0s * 15fps = 45 frames)
    pre_buffer = deque(maxlen=PRE_BUFFER_SIZE)

    # Active recording clips: { detection_id: { "pre_frames": [...], "post_frames": [...], "emp_id": str, "match_pct": float, "target_frames": int } }
    active_recordings: Dict[str, dict] = {}
    active_recordings_lock = threading.Lock()

    # Per-person cooldown tracker: { emp_id: last_detected_timestamp }
    cooldown_tracker: Dict[str, float] = {}

    # Open RTSP Stream
    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        # Fallback to test pattern if RTSP URL is unreachable locally
        print(f"⚠️ [Stream Warning] Could not open RTSP: {rtsp_url}. Using synthetic video pattern.")
        cap = None

    frame_interval = 1.0 / FRAME_STREAM_FPS
    loop = asyncio.get_event_loop()

    try:
        while True:
            start_time = time.time()

            # Read frame
            if cap is not None and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    # Stream ended or stalled, attempt reconnect
                    await asyncio.sleep(0.5)
                    cap = cv2.VideoCapture(rtsp_url)
                    continue
            else:
                # Generate synthetic test frame
                frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8)
                frame[:] = (30, 30, 30)
                ts_str = time.strftime("%Y-%m-%d %H:%M:%S")
                cv2.putText(frame, f"LIVE RTSP STREAM [SIMULATED]", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 200), 2)
                cv2.putText(frame, f"URL: {rtsp_url[:45]}...", (20, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)
                cv2.putText(frame, f"TIME: {ts_str}", (20, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Resize to standard transmission size
            if frame.shape[:2] != (FRAME_HEIGHT, FRAME_WIDTH):
                frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

            # Store in pre-buffer
            pre_buffer.append(frame.copy())

            # Check any active clip recordings collecting post-frames
            clips_to_finalize = []
            with active_recordings_lock:
                for det_id, rec in list(active_recordings.items()):
                    rec["post_frames"].append(frame.copy())
                    if len(rec["post_frames"]) >= rec["target_frames"]:
                        clips_to_finalize.append(det_id)

            # Face Detection & Recognition logic (every 3rd frame to save CPU)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=4, minSize=(60, 60))

            annotated_frame = frame.copy()

            for (x, y, w, h) in faces:
                # Draw bounding box
                cv2.rectangle(annotated_frame, (x, y), (x+w, y+h), (0, 0, 255), 2)

                face_roi = gray[y:y+h, x:x+w]
                match_result = match_face(face_roi)

                if match_result:
                    emp_id, match_pct = match_result
                    cv2.putText(annotated_frame, f"WANTED: {emp_id} ({match_pct}%)", (x, max(y-8, 15)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

                    # Check 60s cooldown
                    last_time = cooldown_tracker.get(emp_id, 0)
                    now = time.time()
                    if now - last_time >= COOLDOWN_SECONDS:
                        cooldown_tracker[emp_id] = now
                        det_uuid = str(uuid.uuid4())

                        # Crop face thumbnail
                        face_crop = frame[y:y+h, x:x+w]
                        _, face_buf = cv2.imencode(".jpg", face_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        face_b64 = base64.b64encode(face_buf).decode("utf-8")

                        # Full snapshot
                        _, snap_buf = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        snap_b64 = base64.b64encode(snap_buf).decode("utf-8")

                        # Send Instant Detection message
                        detection_msg = {
                            "type": "detection",
                            "detection_id": det_uuid,
                            "emp_id": emp_id,
                            "match_percentage": match_pct,
                            "face_image": face_b64,
                            "snapshot": snap_b64,
                            "clip_incoming": True,
                            "clip_eta_seconds": CLIP_POST_SECONDS
                        }
                        await websocket.send_json(detection_msg)
                        print(f"🚨 [DETECTION EMITTED] {emp_id} ({match_pct}%) [ID: {det_uuid}]")

                        # Start collecting post-frames for ~7s clip
                        with active_recordings_lock:
                            active_recordings[det_uuid] = {
                                "detection_id": det_uuid,
                                "emp_id": emp_id,
                                "match_percentage": match_pct,
                                "pre_frames": list(pre_buffer),
                                "post_frames": [],
                                "target_frames": POST_BUFFER_SIZE,
                                "start_time": now
                            }

            # 1. Send Frame message (~15 FPS)
            _, jpeg_buf = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_b64 = base64.b64encode(jpeg_buf).decode("utf-8")
            await websocket.send_json({
                "type": "frame",
                "frame": frame_b64
            })

            # 2. Finalize any completed clips in background and send detection_clip message
            for det_id in clips_to_finalize:
                with active_recordings_lock:
                    rec = active_recordings.pop(det_id, None)

                if rec:
                    all_frames = rec["pre_frames"] + rec["post_frames"]
                    duration = round(len(all_frames) / ASSUMED_CAMERA_FPS, 2)

                    # Encode MP4 asynchronously
                    def encode_and_send(r=rec, frames=all_frames, dur=duration):
                        mp4_bytes = encode_frames_to_mp4(frames, fps=ASSUMED_CAMERA_FPS)
                        if mp4_bytes:
                            clip_b64 = base64.b64encode(mp4_bytes).decode("utf-8")
                            clip_msg = {
                                "type": "detection_clip",
                                "detection_id": r["detection_id"],
                                "emp_id": r["emp_id"],
                                "match_percentage": r["match_percentage"],
                                "clip_duration_seconds": dur,
                                "clip_mime": "video/mp4",
                                "clip_base64": clip_b64
                            }
                            asyncio.run_coroutine_threadsafe(websocket.send_json(clip_msg), loop)
                            print(f"🎬 [CLIP EMITTED] {r['emp_id']} [ID: {r['detection_id']}] ({dur}s, {len(mp4_bytes)} bytes)")

                    threading.Thread(target=encode_and_send, daemon=True).start()

            # Maintain frame pacing
            elapsed = time.time() - start_time
            sleep_time = max(0.005, frame_interval - elapsed)
            await asyncio.sleep(sleep_time)

    except WebSocketDisconnect:
        print(f"🔌 [WS Disconnected] Stream ID: {stream_id}")
    except Exception as e:
        print(f"❌ [WS Error] Stream ID: {stream_id} - {e}")
    finally:
        with active_recognizers_lock:
            active_recognizers.pop(stream_id, None)
        if cap is not None and cap.isOpened():
            cap.release()


if __name__ == "__main__":
    import uvicorn
    print("=================================================================")
    print("🚀 Starting Face Recognition & Video Clip AI Server on Port 8090")
    print("=================================================================")
    uvicorn.run(app, host="0.0.0.0", port=8090)
