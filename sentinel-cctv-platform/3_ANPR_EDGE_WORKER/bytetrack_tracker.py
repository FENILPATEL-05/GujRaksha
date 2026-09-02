import numpy as np
from typing import List, Dict, Any

def compute_box_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = max(1, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(1, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))
    return interArea / float(boxAArea + boxBArea - interArea)

class ByteTrackTracker:
    """
    Multi-Object Tracker using two-stage ByteTrack IoU association.
    Maintains persistent track IDs across frames and handles partial occlusions.
    """
    def __init__(self, max_lost=30, iou_thresh=0.25, high_conf_thresh=0.40):
        self.next_id = 1
        self.tracks = {}
        self.max_lost = max_lost
        self.iou_thresh = iou_thresh
        self.high_conf_thresh = high_conf_thresh

    def update(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Takes raw detections: [{"box": [x1, y1, x2, y2], "confidence": float, "class_id": int, "label": str}]
        Returns tracked objects with persistent 'track_id'.
        """
        updated_tracks = []
        high_dets = []
        low_dets = []

        for idx, det in enumerate(detections):
            conf = det.get("confidence", 0.0)
            if conf >= self.high_conf_thresh:
                high_dets.append((idx, det))
            else:
                low_dets.append((idx, det))

        unmatched_track_ids = list(self.tracks.keys())
        unmatched_high_dets = high_dets.copy()

        # 1. Match high-confidence detections with existing tracks
        for track_id in list(unmatched_track_ids):
            track = self.tracks[track_id]
            best_iou = 0.0
            best_match_idx = -1
            best_det = None

            for i, (det_idx, det) in enumerate(unmatched_high_dets):
                if det.get("class_id") == track["class_id"] or det.get("label") == track["label"]:
                    iou = compute_box_iou(track["box"], det["box"])
                    if iou > best_iou:
                        best_iou = iou
                        best_match_idx = i
                        best_det = det

            if best_iou >= self.iou_thresh and best_det is not None:
                # Update track with new observation
                track["box"] = best_det["box"]
                track["confidence"] = best_det["confidence"]
                track["lost"] = 0
                unmatched_high_dets.pop(best_match_idx)
                unmatched_track_ids.remove(track_id)

                updated_tracks.append({
                    **best_det,
                    "track_id": track_id
                })

        # 2. Second Association: Match remaining tracks with low-confidence detections
        unmatched_low_dets = low_dets.copy()
        for track_id in list(unmatched_track_ids):
            track = self.tracks[track_id]
            best_iou = 0.0
            best_match_idx = -1
            best_det = None

            for i, (det_idx, det) in enumerate(unmatched_low_dets):
                if det.get("class_id") == track["class_id"] or det.get("label") == track["label"]:
                    iou = compute_box_iou(track["box"], det["box"])
                    if iou > best_iou:
                        best_iou = iou
                        best_match_idx = i
                        best_det = det

            if best_iou >= self.iou_thresh and best_det is not None:
                track["box"] = best_det["box"]
                track["confidence"] = best_det["confidence"]
                track["lost"] = 0
                unmatched_low_dets.pop(best_match_idx)
                unmatched_track_ids.remove(track_id)

                updated_tracks.append({
                    **best_det,
                    "track_id": track_id
                })

        # 3. Create new tracks for unmatched high-confidence detections
        for _, det in unmatched_high_dets:
            new_id = self.next_id
            self.next_id += 1
            self.tracks[new_id] = {
                "box": det["box"],
                "confidence": det["confidence"],
                "class_id": det.get("class_id", 0),
                "label": det.get("label", "OBJECT"),
                "lost": 0
            }
            updated_tracks.append({
                **det,
                "track_id": new_id
            })

        # 4. Increment lost counter for unmatched tracks and purge dead ones
        for track_id in unmatched_track_ids:
            self.tracks[track_id]["lost"] += 1
            if self.tracks[track_id]["lost"] > self.max_lost:
                del self.tracks[track_id]

        return updated_tracks
