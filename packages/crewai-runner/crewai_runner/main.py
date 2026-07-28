from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from crewai_runner.health import health_payload
from crewai_runner.kickoff import run_kickoff
from crewai_runner.stream import stream_kickoff_events

app = FastAPI(title="CrewAI Runner")


@app.get("/health")
def health() -> dict:
    return health_payload()


@app.post("/v1/kickoff")
def kickoff(body: dict) -> dict:
    try:
        return run_kickoff(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/v1/kickoff/stream")
async def kickoff_stream(body: dict) -> StreamingResponse:
    return StreamingResponse(
        stream_kickoff_events(body),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
