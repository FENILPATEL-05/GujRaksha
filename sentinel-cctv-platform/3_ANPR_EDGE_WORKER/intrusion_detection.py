import cv2
import numpy as np

class IntrusionZone:
    """
    Virtual Security Perimeter Intrusion Zone detector using polygonal boundary test.
    """
    def __init__(self, points):
        self.points = points
        self.polygon = np.array(points, dtype=np.int32)
        self.inside_ids = {}

    def check(self, cls_name, track_id, box):
        x1, y1, x2, y2 = box
        cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
        inside = cv2.pointPolygonTest(self.polygon, (float(cx), float(cy)), False) >= 0
        key = (cls_name, track_id)
        was_inside = self.inside_ids.get(key, False)
        self.inside_ids[key] = inside
        entered = inside and not was_inside
        return inside, entered, (cx, cy)

    def draw(self, frame, active=False):
        color = (0, 0, 255) if active else (0, 255, 0)
        cv2.polylines(frame, [self.polygon], True, color, 2)
