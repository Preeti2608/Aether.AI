# 🧠 Aether AI

<div align="center">
  <img src="./docs/logo.svg" width="80" alt="Aether AI Logo" />
  <h3>Privacy-First, Offline AI Second Brain</h3>
  <p>Powered by Local LLMs via Ollama · ChromaDB · React · FastAPI</p>
  <br/>
  
  ![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python)
  ![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square&logo=fastapi)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
  ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38BDF8?style=flat-square&logo=tailwindcss)
  ![Ollama](https://img.shields.io/badge/Ollama-Local_LLM-orange?style=flat-square)
  ![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)
</div>

---

## 📖 Overview

**Aether AI** is a production-inspired, privacy-first AI Second Brain that runs entirely on your device. Built around the hackathon theme of **On-Device AI**, Aether integrates with [Ollama](https://ollama.ai) to power all AI features locally — no cloud subscriptions, no data leaving your machine, no privacy trade-offs.

Think of Aether as your personal knowledge companion that:
- 💬 **Chats** with you intelligently and remembers context across conversations
- 🧠 **Remembers** important facts, preferences, and learnings permanently  
- 📄 **Reads your PDFs** and lets you have natural conversations about them  
- 📝 **Takes and organizes notes** with AI writing assistance  
- 🔍 **Finds information semantically** — by meaning, not just keywords  
- 📁 **Organizes everything** into smart collections

---

## 🔒 Why Offline?

Unlike cloud-based AI assistants, Aether AI runs entirely on your own device.

- No OpenAI API
- No Gemini API
- No Anthropic API
- No internet required after setup
- Your data never leaves your computer
- Complete privacy with local AI inference through Ollama

---

## ✨ Features

### 🤖 AI Chat
- ChatGPT-style interface with full Markdown and code syntax highlighting
- Persistent conversation history across sessions
- Animated typing indicator and streaming responses
- Copy messages, regenerate responses, edit session titles
- Automatic memory extraction from conversations

### 🧠 Long-Term Memory
- Save facts, preferences, project notes, learnings, personal notes
- Automatic semantic embedding via sentence-transformers
- Intelligent retrieval using cosine similarity (not keyword search)
- Pin important memories, filter by category, semantic search
- Automatically extracts and stores important user information for future semantic search.

### 🔍 Semantic Search
- Unified search across memories, notes, and PDF documents
- Returns results ranked by semantic similarity score
- Filter by content type (memory / note / document)
- Visual relevance score bars

### 📄 PDF Chat
- Drag-and-drop PDF upload with automatic text extraction
- Chunking + embedding pipeline for large documents
- RAG-powered Q&A with source citations
- One-click document summarization
- Multi-document management

### 📝 Smart Notes
- Rich Markdown notes with live preview
- AI actions: Summarize, Improve Writing, Expand, Fix Grammar
- Tags, colors, pin notes, organize into collections
- Semantic search within notes

### 📊 Dashboard
- Live stats: chats, memories, notes, PDFs
- AI model status (Ollama connection health)
- Recent activity feed
- Quick action shortcuts

### 📁 Collections
- Organize memories and notes into named collections
- Default collections: Study, Projects, Personal, Work
- Custom icons and color themes per collection
- View all items within a collection

### ⚙️ Settings
- Dark / Light theme toggle
- Select active local AI model from Ollama
- Export all data as JSON
- Clear memory or full reset

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Aether AI Frontend                  │
│              React + Vite + Tailwind + Zustand           │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (HTTP)
┌────────────────────────▼────────────────────────────────┐
│                   FastAPI Backend                        │
│   /chat  /memory  /notes  /documents  /search  /stats   │
└──────────┬──────────────────┬───────────────────────────┘
           │                  │
┌──────────▼───────┐  ┌───────▼─────────────────────────┐
│     Ollama        │  │         ChromaDB                 │
│  (Local LLMs)     │  │   (Vector Embeddings Store)      │
│  phi3 / qwen      │  │   memories / notes / docs        │
│  llama / mistral  │  └─────────────────────────────────┘
└──────────────────┘           │
                       ┌───────▼─────────────────────────┐
                       │   Sentence Transformers           │
                       │   all-MiniLM-L6-v2 embeddings    │
                       └─────────────────────────────────┘
                                │
                       ┌───────▼─────────────────────────┐
                       │       SQLite (aiosqlite)          │
                       │   chats / notes / memories /      │
                       │   documents / collections         │
                       └─────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 + Vite 5 |
| **UI Styling** | Tailwind CSS 3.4 |
| **Animations** | Framer Motion |
| **State Management** | Zustand (persistent) |
| **HTTP Client** | Axios |
| **Markdown** | react-markdown + remark-gfm |
| **Code Highlighting** | react-syntax-highlighter |
| **Backend Framework** | FastAPI + Uvicorn |
| **ORM / Database** | SQLAlchemy Async + SQLite |
| **Local LLM** | Ollama (phi3, qwen, llama, etc.) |
| **Vector Database** | ChromaDB (persistent) |
| **Embeddings** | sentence-transformers (all-MiniLM-L6-v2) |
| **PDF Processing** | pypdf |
| **Logging** | Loguru |

---

## 📁 Project Structure

```
aether-ai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── chat.py        # Chat sessions + messages
│   │   │       ├── memory.py      # Long-term memory CRUD + search
│   │   │       ├── notes.py       # Smart notes + AI actions
│   │   │       ├── documents.py   # PDF upload + RAG chat
│   │   │       ├── collections.py # Collections management
│   │   │       ├── search.py      # Unified semantic search
│   │   │       └── dashboard.py   # Stats + settings + export
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic settings
│   │   │   ├── database.py       # Async SQLAlchemy setup
│   │   │   ├── ollama_client.py  # Ollama HTTP client
│   │   │   └── vector_store.py   # ChromaDB + embeddings
│   │   ├── models/               # SQLAlchemy ORM models
│   │   └── main.py               # FastAPI app entry point
│   ├── data/
│   │   ├── chroma_db/            # Persistent vector store
│   │   └── uploads/              # Uploaded PDF files
│   ├── requirements.txt
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── layout/
    │   │       ├── Layout.tsx    # App shell
    │   │       ├── Sidebar.tsx   # Navigation sidebar
    │   │       └── TopBar.tsx    # Top header
    │   ├── pages/
    │   │   ├── Dashboard.tsx     # Stats + activity
    │   │   ├── Chat.tsx          # AI Chat interface
    │   │   ├── Memory.tsx        # Memory management
    │   │   ├── Notes.tsx         # Smart notes editor
    │   │   ├── PDFChat.tsx       # PDF upload + chat
    │   │   ├── Search.tsx        # Semantic search
    │   │   ├── Collections.tsx   # Collections browser
    │   │   └── Settings.tsx      # App settings
    │   ├── services/
    │   │   └── api.ts            # Axios API client
    │   ├── store/
    │   │   └── appStore.ts       # Zustand global state
    │   └── utils/
    │       └── helpers.ts        # Utility functions
    ├── package.json
    └── tailwind.config.js
```

---

## 🚀 Installation Guide

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Ollama | Latest | [ollama.ai](https://ollama.ai) |

### Step 1: Install Ollama + Pull a Model

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download from https://ollama.ai

# Start Ollama
ollama serve

# Pull a model (choose one)
ollama pull phi3        # Recommended: fast, good quality
ollama pull qwen        # Alternative: multilingual
ollama pull llama3      # Larger, higher quality
```

### Step 2: Backend Setup

```bash
cd aether-ai/backend

# Create virtual environment
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate
# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend
python run.py
```

Backend runs at: http://localhost:8000  
API Docs: http://localhost:8000/api/docs

### Step 3: Frontend Setup

```bash
cd aether-ai/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: http://localhost:5173

### Step 4: Open Aether AI

Navigate to **http://localhost:5173** in your browser.

You should see:
- ✅ **AI Ready** badge (green) in the top bar
- Active model name shown in the sidebar

---

## 🔧 Configuration

### Backend `.env`

```env
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=phi3
DATABASE_URL=sqlite+aiosqlite:///./data/aether.db
CHROMA_DB_PATH=./data/chroma_db
UPLOAD_DIR=./data/uploads
```

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

<!-- --- -->
<!-- 
## 📸 Screenshots

> _Screenshots will be added after the final build_

| Dashboard | AI Chat | Memory |
|-----------|---------|--------|
| ![Dashboard]() | ![Chat]() | ![Memory]() |

| Smart Notes | PDF Chat | Search |
|-------------|----------|--------|
| ![Notes]() | ![PDF]() | ![Search]() | -->

---

## 🔮 Future Scope

- [ ] **Voice Input** — Speak to Aether using Whisper (local transcription)
- [ ] **Multi-modal** — Image understanding with local vision models (LLaVA)
- [ ] **Knowledge Graph** — Visual graph of memory connections
- [ ] **Calendar Integration** — Schedule and reminder tracking
- [ ] **Browser Extension** — Save web content to memory
- [ ] **Mobile App** — React Native companion app
- [ ] **Plugin System** — Custom tools and integrations
- [ ] **Collaborative Spaces** — Share collections with team members (local network)
- [ ] **Memory** — Cross-session intelligent memory recall
- [ ] **Agent Mode** — Multi-step task execution with tool use

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 🏆 Built For

**OSDHack 2026**

Theme: **On-Device AI**

Aether AI is designed as a privacy-first AI Second Brain where all core AI capabilities run locally using Ollama without relying on cloud AI APIs.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ for the On-Device AI Hackathon</p>
  <p><strong>Aether AI</strong> — Your Private AI Workspace — Running Completely Offline.</p>
</div>
