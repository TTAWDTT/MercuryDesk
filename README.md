# MercuryDesk (MVP)

基于 `report.md` 的一个可运行 MVP：后端提供统一消息模型与“按发信人聚合”的 API，前端提供联系人（发信人）聚合视图，并内置 `mock` 连接器用于本地演示与测试。

## 快速开始（本机）

### 后端

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 前端

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，使用 `Register + Login` 创建账号后，点击 `Sync demo` 拉取演示消息。

## 测试

### 后端测试

```powershell
cd backend
pytest
```

### 前端测试与构建

```powershell
cd frontend
npm test
npm run build
```

