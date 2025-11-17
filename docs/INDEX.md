# Documentation Index

This directory contains the complete technical documentation for the CodeTutor project.

## 📖 Reading Order

It is recommended to read the documentation in the following order to fully understand the project:

### 1️⃣ Product Level
- **[PRD.md](PRD.md)** - Product Requirements Document
  - Understand product positioning, target users
  - Core functions and user stories
  - Adaptive algorithm and scoring system design

### 2️⃣ Technical Design
- **[TECH_DESIGN.md](TECH_DESIGN.md)** - Technical Design Document
  - System architecture and tech stack
  - Database design (table structure, indexes)
  - API design (RESTful + WebSocket)
  - LLM integration scheme

### 3️⃣ Frontend Design
- **[FRONTEND_DESIGN.md](FRONTEND_DESIGN.md)** - Frontend Design Document
  - Page design and wireframes
  - Component breakdown and directory structure
  - UI/UX interaction flows
  - Development specifications

### 4️⃣ Infrastructure Deployment

**Must deploy these two first before starting development!**

- **[DATABASE_DEPLOYMENT.md](DATABASE_DEPLOYMENT.md)** - Database Deployment Document
  - PostgreSQL 16 deployment guide
  - Redis 7 configuration
  - Prisma ORM setup
  - Backup and recovery strategies

- **[CODE_EXECUTOR_DEPLOYMENT.md](CODE_EXECUTOR_DEPLOYMENT.md)** - Code Executor Deployment Document
  - Judge0 CE official image deployment
  - Docker Compose configuration
  - Backend integration and API calls
  - Troubleshooting and performance optimization

### 5️⃣ Development Guide
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - Development Guide
  - Project structure and directory tree
  - Environment setup and dependency installation
  - Development phase division (MVP → P1 → P2)
  - Git workflow and code standards
  - Quick command reference

---

## 📋 Documentation Overview

| Document | Main Content | Target Audience |
|----------|--------------|----------------|
| **PRD.md** | Product requirements, function design, scoring algorithm | All, Product, Development |
| **TECH_DESIGN.md** | System architecture, API, database | Development, Architects |
| **FRONTEND_DESIGN.md** | Page design, components, interactions | Frontend Development |
| **DATABASE_DEPLOYMENT.md** | Database deployment and operations | Backend Development, Operations |
| **CODE_EXECUTOR_DEPLOYMENT.md** | Code executor deployment | Backend Development, Operations |
| **DEVELOPMENT_GUIDE.md** | Development process, project structure | All Developers |

---

## 🎯 Quick Lookup

### I want to understand...

**Product functions?**
→ Read [PRD.md](PRD.md) Section 3 「Core Function Modules」

**Database table structure?**
→ Read [TECH_DESIGN.md](TECH_DESIGN.md) Section 2 「Database Design」

**What does the page look like?**
→ Read [FRONTEND_DESIGN.md](FRONTEND_DESIGN.md) Section 3 「Page Design」

**How to deploy database?**
→ Read [DATABASE_DEPLOYMENT.md](DATABASE_DEPLOYMENT.md) Section 3 「Deployment Steps」

**How to deploy code executor?**
→ Read [CODE_EXECUTOR_DEPLOYMENT.md](CODE_EXECUTOR_DEPLOYMENT.md) Section 3 「Deployment Steps」

**How to start development?**
→ Read [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) Section 4 「Development Environment Setup」

**How many phases is development divided into?**
→ Read [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) Section 5 「Development Phase Division」

**What are the API endpoints?**
→ Read [TECH_DESIGN.md](TECH_DESIGN.md) Section 3 「API Design」

**How to integrate LLM?**
→ Read [TECH_DESIGN.md](TECH_DESIGN.md) Section 4 「LLM Integration Scheme」

**What is the adaptive algorithm like?**
→ Read [PRD.md](PRD.md) Section 3.7 「Adaptive Difficulty System」

**How is scoring calculated?**
→ Read [PRD.md](PRD.md) Section 3.6 「Scoring System」

---

## ✅ Pre-Development Checklist

Before starting development, ensure completion of the following steps:

### Phase 0: Infrastructure (Must complete first!)

- [ ] Read through **DATABASE_DEPLOYMENT.md**
- [ ] Deploy PostgreSQL + Redis
- [ ] Test database connection
- [ ] Run initialization script (`init.sql`)
- [ ] Read through **CODE_EXECUTOR_DEPLOYMENT.md**
- [ ] Deploy Judge0
- [ ] Test code execution (submit test code)
- [ ] Verify all languages are available

### Phase 1: Development Preparation

- [ ] Read through all documentation
- [ ] Install Node.js 20, pnpm 8
- [ ] Configure environment variables
- [ ] Create project directory structure
- [ ] Initialize Git repository

---

## 📊 Documentation Statistics

- **Total Documents**: 6
- **Total Pages**: Approximately 150+ pages (Markdown)
- **Code Examples**: 100+ pieces
- **Charts/Wireframes**: 20+ pieces
- **Last Updated**: 2024-11-04

---

## 🔄 Documentation Update Records

| Date | Document | Update Content |
|------|----------|---------------|
| 2024-11-04 | All | Initial version creation |

---

## 💡 Contributing to Documentation

Found documentation issues or have improvement suggestions?

1. Create an Issue describing the problem
2. Or directly submit a PR to modify the documentation
3. Documentation follows Markdown specifications

---

**Wish you smooth development!** 🚀
