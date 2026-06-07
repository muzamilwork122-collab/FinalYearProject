FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p models_weights

# Download models on build if IDs are provided
ARG SEGMENTATION_FILE_ID=""
ARG SEVERITY_FILE_ID=""
RUN if [ -n "$SEGMENTATION_FILE_ID" ]; then \
    python download_models.py; \
    fi

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]