#!/bin/sh
export PYTHONNOUSERSITE=1
export PYTHONPATH="/opt/vllm/python${PYTHONPATH:+:${PYTHONPATH}}"
export VLLM_PLUGINS="${VLLM_PLUGINS:-gguf}"
exec /usr/bin/python -m vllm.entrypoints.cli.main "$@"
