import importlib.util
import tempfile
import unittest
from pathlib import Path


CLIENT_PATH = (
    Path(__file__).resolve().parents[1]
    / "pinokio_agent"
    / "skills"
    / "api"
    / "whisper-webui.git"
    / "clients"
    / "transcribe.py"
)
SPEC = importlib.util.spec_from_file_location("whisper_webui_client", CLIENT_PATH)
CLIENT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CLIENT)


class GradioInputDataTests(unittest.TestCase):
    def test_assigns_only_matching_model_and_diarization_controls(self):
        components = [
            {"id": 1, "type": "file", "props": {"label": "Upload File here", "file_count": "multiple"}},
            {"id": 2, "type": "dropdown", "props": {"label": "Model", "value": "large-v2", "choices": [["distil-large-v3", "distil-large-v3"]]}},
            {"id": 3, "type": "dropdown", "props": {"label": "Language", "value": "Automatic Detection", "choices": [["english", "english"]]}},
            {"id": 4, "type": "checkbox", "props": {"label": "Enable Diarization", "value": False}},
            {"id": 5, "type": "dropdown", "props": {"label": "Device", "value": "mps", "choices": [["cpu", "cpu"], ["mps", "mps"]]}},
            {"id": 6, "type": "textbox", "props": {"label": "HuggingFace Token", "value": ""}},
            {"id": 7, "type": "checkbox", "props": {"label": "Enable Background Music Remover Filter", "value": False}},
            {"id": 8, "type": "dropdown", "props": {"label": "Model", "value": "UVR-MDX", "choices": [["UVR-MDX", "UVR-MDX"]]}},
            {"id": 9, "type": "dropdown", "props": {"label": "Device", "value": "mps", "choices": [["cpu", "cpu"], ["mps", "mps"]]}},
        ]
        config = {"components": components}
        dependency = {"inputs": list(range(1, 10))}
        with tempfile.NamedTemporaryFile(suffix=".mp3") as audio:
            values = CLIENT._gradio_input_data(
                config,
                dependency,
                Path(audio.name),
                "/tmp/uploaded.mp3",
                "distil-whisper/distil-large-v3",
                "en",
                True,
                "cpu",
                True,
                "secret-token",
            )

        self.assertIsInstance(values[0], list)
        self.assertEqual(values[1], "distil-large-v3")
        self.assertEqual(values[2], "english")
        self.assertTrue(values[3])
        self.assertEqual(values[4], "cpu")
        self.assertEqual(values[5], "secret-token")
        self.assertTrue(values[6])
        self.assertEqual(values[7], "UVR-MDX")
        self.assertEqual(values[8], "mps")


if __name__ == "__main__":
    unittest.main()
