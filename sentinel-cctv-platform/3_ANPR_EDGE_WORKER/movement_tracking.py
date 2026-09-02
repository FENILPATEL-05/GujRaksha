from collections import defaultdict
import time
from datetime import datetime

class TrailTracker:
    """
    Tracks centroid movement history (trails) for multi-object tracking.
    Maintains pixel coordinates and normalized coordinates for live video HUDs.
    """
    def __init__(self, max_trail_length=45):
        self.trails = defaultdict(list)
        self.normalized_trails = defaultdict(list)
        self.first_seen = {}
        self.last_seen = {}
        self.max_trail_length = max_trail_length

    def update(self, cls_name, track_id, cx, cy, norm_cx=None, norm_cy=None, epoch=None):
        if epoch is None:
            epoch = time.time()
        key = (cls_name, track_id)
        if key not in self.first_seen:
            self.first_seen[key] = epoch
        self.last_seen[key] = epoch

        # Store pixel points
        trail = self.trails[key]
        trail.append((epoch, cx, cy))
        if len(trail) > self.max_trail_length:
            trail.pop(0)

        # Store normalized points if provided
        if norm_cx is not None and norm_cy is not None:
            norm_trail = self.normalized_trails[key]
            norm_trail.append([round(norm_cx, 4), round(norm_cy, 4)])
            if len(norm_trail) > self.max_trail_length:
                norm_trail.pop(0)

    def get_points(self, cls_name, track_id):
        """Returns list of (cx, cy) pixel coordinates."""
        return [(cx, cy) for _, cx, cy in self.trails.get((cls_name, track_id), [])]

    def get_normalized_points(self, cls_name, track_id):
        """Returns list of [norm_x, norm_y] (0.0 to 1.0) coordinates for frontend canvas."""
        return self.normalized_trails.get((cls_name, track_id), [])

    def cleanup_stale(self, max_age_seconds=10.0):
        """Purges tracks that haven't been seen recently."""
        now = time.time()
        stale_keys = [k for k, last_t in self.last_seen.items() if (now - last_t) > max_age_seconds]
        for k in stale_keys:
            self.trails.pop(k, None)
            self.normalized_trails.pop(k, None)
            self.first_seen.pop(k, None)
            self.last_seen.pop(k, None)

    def summary_rows(self, camera_id):
        rows = []
        for (cls_name, track_id), trail in self.trails.items():
            first_epoch = self.first_seen.get((cls_name, track_id), 0)
            last_epoch = self.last_seen.get((cls_name, track_id), 0)
            rows.append([
                camera_id,
                cls_name,
                track_id,
                datetime.fromtimestamp(first_epoch).isoformat() if first_epoch else "",
                datetime.fromtimestamp(last_epoch).isoformat() if last_epoch else "",
                round(last_epoch - first_epoch, 2),
                len(trail),
            ])
        return rows
