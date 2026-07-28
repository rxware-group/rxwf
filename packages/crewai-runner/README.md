# crewai-runner

Python FastAPI sidecar that executes CrewAI workflows for RX-Workflow.

## Run locally

```bash
cd packages/crewai-runner
pip install -e ".[dev]"
uvicorn crewai_runner.main:app --host 0.0.0.0 --port 8071
```

Health check: `GET http://localhost:8071/health`

## Docker

```bash
cd packages/crewai-runner
docker build -t crewai-runner .
docker run --rm -p 8071:8071 crewai-runner
```

## Tests

```bash
pip install -e ".[dev]"
pytest tests/ -v
```
