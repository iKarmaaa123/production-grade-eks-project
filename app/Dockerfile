FROM python:3.11-slim as Build

WORKDIR /app

COPY . .

RUN apt-get update && apt-get install -y curl

FROM python:3.11-slim

WORKDIR /app

COPY --from=Build /app /app

RUN useradd -m non-root

USER non-root

EXPOSE 3000

HEALTHCHECK CMD curl -f https://localhost:3000/health || exit 1

CMD ["python", "-m", "http.server", "3000"]