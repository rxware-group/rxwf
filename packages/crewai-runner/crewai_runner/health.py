import crewai


def health_payload() -> dict:
    return {
        "status": "ok",
        "crewaiVersion": crewai.__version__,
        "supportedIrVersions": [1],
    }
