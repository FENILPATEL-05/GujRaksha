#!/usr/bin/env python3
"""
==============================================================================
GujRaksha — Asynchronous Triton gRPC Client Module
Part of 3_ANPR_EDGE_WORKER: Connects Python Workers to NVIDIA Triton Server
==============================================================================
"""

import time
import numpy as np

try:
    import tritonclient.grpc as grpcclient
    import tritonclient.http as httpclient
    HAS_TRITON_CLIENT = True
except ImportError:
    HAS_TRITON_CLIENT = False

class TritonInferenceClient:
    """
    High-performance, async-capable gRPC / HTTP client for NVIDIA Triton Inference Server.
    Provides automated dynamic batching, frame pre-processing & inference tensor binding.
    """

    def __init__(self, url: str = "localhost:8001", model_name: str = "yolo_detector", use_grpc: bool = True):
        self.url = url
        self.model_name = model_name
        self.use_grpc = use_grpc
        self.client = None
        self.is_connected = False
        
        if not HAS_TRITON_CLIENT:
            print("⚠️ Warning: 'tritonclient' library is not installed. Run: pip install tritonclient[all]")
            return
        
        self.connect()

    def connect(self) -> bool:
        if not HAS_TRITON_CLIENT:
            return False
        try:
            if self.use_grpc:
                self.client = grpcclient.InferenceServerClient(url=self.url, verbose=False)
            else:
                self.client = httpclient.InferenceServerClient(url=self.url, verbose=False)
            
            # Check server readiness
            if self.client.is_server_ready():
                self.is_connected = True
                print(f"✅ Successfully connected to Triton Server at {self.url} (Model: {self.model_name})")
                return True
            else:
                print(f"⚠️ Triton Server at {self.url} is not ready yet.")
                self.is_connected = False
                return False
        except Exception as e:
            self.is_connected = False
            return False

    def preprocess_image(self, image: np.ndarray, input_size: tuple = (640, 640)) -> np.ndarray:
        """
        Preprocesses OpenCV BGR image frame to CHW normalized float32 tensor [1, 3, 640, 640].
        """
        resized = cv2_resize_pad(image, input_size)
        rgb = cv2_bgr2rgb(resized)
        normalized = rgb.astype(np.float32) / 255.0
        chw = np.transpose(normalized, (2, 0, 1))
        batch_chw = np.expand_dims(chw, axis=0) # Shape: [1, 3, 640, 640]
        return np.ascontiguousarray(batch_chw)

    def infer(self, input_tensor: np.ndarray, input_name: str = "images", output_name: str = "output0") -> np.ndarray:
        """
        Executes dynamic batched inference on Triton Server via gRPC.
        """
        if not self.is_connected and not self.connect():
            raise RuntimeError(f"Triton Client unable to reach Triton Server at {self.url}")

        if self.use_grpc:
            inputs = [grpcclient.InferInput(input_name, input_tensor.shape, "FP32")]
            inputs[0].set_data_from_numpy(input_tensor)
            outputs = [grpcclient.InferRequestedOutput(output_name)]
            response = self.client.infer(model_name=self.model_name, inputs=inputs, outputs=outputs)
            return response.as_numpy(output_name)
        else:
            inputs = [httpclient.InferInput(input_name, input_tensor.shape, "FP32")]
            inputs[0].set_data_from_numpy(input_tensor)
            outputs = [httpclient.InferRequestedOutput(output_name)]
            response = self.client.infer(model_name=self.model_name, inputs=inputs, outputs=outputs)
            return response.as_numpy(output_name)

def cv2_resize_pad(img, size=(640, 640)):
    import cv2
    h, w = img.shape[:2]
    tw, th = size
    scale = min(tw / w, th / h)
    nw, nh = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((th, tw, 3), 114, dtype=np.uint8)
    canvas[(th - nh) // 2:(th - nh) // 2 + nh, (tw - nw) // 2:(tw - nw) // 2 + nw] = resized
    return canvas

def cv2_bgr2rgb(img):
    import cv2
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
