# 🚀 Quick Start

## Prerequisites

- Python **3.13.5**
- Node.js **18+**
- Ollama (https://ollama.com)

---

## 1. Install Ollama and Download the Model

```bash
ollama pull phi3
```

> Make sure the Ollama application is running.

---

## 2. Start the Backend

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt

python run.py
```

---

## 3. Start the Frontend

```bash
cd frontend

npm install

npm run dev
```

---

## 4. Open Aether AI

| Service | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/api/docs |
