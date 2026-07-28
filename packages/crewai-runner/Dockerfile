FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY crewai_runner ./crewai_runner

RUN pip install --no-cache-dir .

EXPOSE 8071

CMD ["uvicorn", "crewai_runner.main:app", "--host", "0.0.0.0", "--port", "8071"]
