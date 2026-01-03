FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl

RUN useradd -m non-root

USER non-root

COPY . .

EXPOSE 3000

HEALTHCHECK CMD curl -f https://localhost:3000/health || exit 1

CMD ["python", "-m", "http.server", "3000"]