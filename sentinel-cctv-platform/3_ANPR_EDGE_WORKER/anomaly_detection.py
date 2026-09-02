import time

class DwellTracker:
    """
    Detects loitering / stationary anomalies when an object stays continuously
    within the camera view for longer than dwell_threshold seconds.
    """
    def __init__(self, dwell_threshold=8.0):
        self.dwell_threshold = dwell_threshold
        self.enter_times = {}
        self.flagged = set()

    def update(self, cls_name, track_id, inside=True):
        key = (cls_name, track_id)
        now = time.time()
        if inside:
            if key not in self.enter_times:
                self.enter_times[key] = now
            dwell = now - self.enter_times[key]
            if dwell >= self.dwell_threshold:
                self.flagged.add(key)
                return True, dwell
            return False, dwell
        
        self.enter_times.pop(key, None)
        self.flagged.discard(key)
        return False, 0.0

    def cleanup_stale(self, active_keys):
        """Cleans up keys that are no longer present in the frame."""
        tracked = set(active_keys)
        keys_to_remove = [k for k in self.enter_times if k not in tracked]
        for k in keys_to_remove:
            self.enter_times.pop(k, None)
            self.flagged.discard(k)
