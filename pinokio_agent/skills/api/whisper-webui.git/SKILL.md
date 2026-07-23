---
name: api-whisper-webui-git
description: Transcribe local audio through Whisper-WebUI's HTTPS REST or Gradio API and retain diarized results.
---

# Whisper-WebUI API

## Clients

Use `clients/transcribe.py` for file transcription. It auto-detects the documented polling REST API from `openapi.json`; otherwise it uses the file-transcription operation advertised by the Gradio config.

## Operations

- Transcribe one local audio file with optional diarization.
- Poll REST tasks until completion, or consume the Gradio event stream.
- Return the raw task result and an SRT transcript when the interface supplies one.

## Runtime Inputs

- Reachable HTTP or HTTPS base URL supplied with `--url` or `WHISPER_WEBUI_URL`.
- Audio file path and output JSON path.
- Optional Basic Auth supplied through `WHISPER_WEBUI_USERNAME` and `WHISPER_WEBUI_PASSWORD`.
- Optional `HF_TOKEN` for the diarization model; never persist it in output.
- Optional model, language, diarization device, background music removal, and TLS verification settings.

## Outputs

The client writes JSON containing the selected adapter and the completed API result. The LPC workflow in `python/lpc_whisper_analysis.py` sanitizes this response and builds the repository-specific analysis bundle.

## Notes

- Prefer the REST API when both interfaces are exposed because it returns structured segments and durable task status.
- The Gradio adapter discovers component defaults at runtime so input order can change without hardcoded host settings.
- Pass `remove_background_music=True` to enable Whisper-WebUI's UVR filter before transcription.
- Regenerate the client if Whisper-WebUI returns a 404/405 for its documented operations or a 400/422 caused by a changed request schema.
- On Intel macOS, the verified local stack uses PyTorch/TorchAudio 2.2.2, NumPy 1.26.4, SciPy 1.11.4, Gradio 5.29.0, and huggingface-hub 0.28.1. Guard every `torch.xpu.is_available()` call with `hasattr(torch, "xpu")` because this PyTorch build does not expose the XPU namespace.
