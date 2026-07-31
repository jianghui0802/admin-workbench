> ⚠️ **中文用户请看**：详细的中文部署说明已移到「部署到云端手机访问.md」文件，推荐直接看那个。下面是英文+技术向的方案对比。
>
> 👉 快速回答：是的，手机版必须部署到云端，数据保存在云端数据库 + JSON 备份双重保险，不会丢。

# 行政工作台 - 部署指南

## 方案对比

| 方案 | 难度 | 费用 | 数据持久化 | 推荐度 |
|------|------|------|-----------|--------|
| **Railway** | 简单 | 免费（$5/月额度） | 有持久化磁盘 | ⭐⭐⭐ 推荐 |
| **Render** | 最简单 | 免费 | 重启后数据会清 | ⭐⭐ 次选 |
| **自己的电脑 + ngrok** | 中等 | 免费 | 数据在自己电脑 | ⭐⭐ 临时用 |
| **阿里云/腾讯云/云服务器** | 中等 | 新用户免费试用 | 完全持久化 | ⭐⭐⭐ 长期用 |

---

## 推荐方案：Railway（5 分钟搞定）

Railway 提供每月 $5 的免费额度，足够跑这个系统。支持持久化磁盘，数据不会丢。

### 步骤 1：把代码上传到 GitHub

1. 打开 [github.com](https://github.com)，注册/登录
2. 点击右上角 `+` → `New repository`
3. 仓库名填 `admin-workbench`，选 `Public`（免费）
4. 不要勾选 "Add a README"
5. 点击 `Create repository`
6. 页面会显示推送命令，复制这一段：

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/admin-workbench.git
git push -u origin main
```

如果你不会用 git，也可以直接把整个 `admin-workbench` 文件夹**拖拽**上传到 GitHub（在仓库页面点 `uploading an existing file`）。

### 步骤 2：在 Railway 部署

1. 打开 [railway.app](https://railway.app)，用 GitHub 账号登录
2. 点击 `New Project`
3. 选择 `Deploy from GitHub repo`
4. 找到并选择 `admin-workbench`
5. Railway 会自动识别 Node.js 项目并部署
6. 等待 1-2 分钟，状态变绿后点击域名，你的网址就出来了

### 步骤 3：配置持久化磁盘（重要！不然重启数据会丢）

1. 在 Railway 项目页面，点击你的服务
2. 点击 `Settings` → `Volumes`
3. 点击 `New Volume`，Mount Path 填 `/app/data`
4. 然后回到 `Variables`，添加一个环境变量：
   - `DB_PATH` = `/app/data/workbench.sqlite`

### 步骤 4：固定网址

1. Railway 会给一个随机域名，比如 `xxx.up.railway.app`
2. 点击 `Settings` → `Domains`，可以绑定自己的域名（可选）
3. 把网址收藏在浏览器书签栏，换电脑登录同一个账号就能同步数据

---

## 次选方案：Render（最简单，3 分钟搞定）

Render 完全免费，但免费实例空闲 15 分钟后会休眠，再次访问要等 10-30 秒启动。**休眠重启后数据会清空**。

### 步骤 1：上传代码到 GitHub（同上）

### 步骤 2：在 Render 部署

1. 打开 [render.com](https://render.com)，用 GitHub 登录
2. 点击 `New +` → `Web Service`
3. 连接你的 GitHub 仓库 `admin-workbench`
4. 配置如下：
   - Name: `admin-workbench`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plan: `Free`
5. 点击 `Advanced`，添加环境变量：
   - `JWT_SECRET` → 随便填一串字母数字（至少 20 位）
6. 点击 `Create Web Service`
7. 等待 2-3 分钟，完成后点击链接即可访问

### ⚠️ Render 数据持久化问题

Render 免费实例没有持久化磁盘。如果你更新了代码重新部署，或者实例休眠后重启，数据库会被重置。

**解决方案**：把数据定期导出到本地保存，或者升级到 Render 的 Starter 计划（$7/月）获得持久化磁盘。

---

## 方案三：用自己的电脑 + ngrok（临时方案）

如果你暂时不想上云，可以在自己电脑上跑服务，然后用 ngrok 暴露到公网。

### 步骤

1. 在自己电脑上安装 Node.js（[nodejs.org](https://nodejs.org)）
2. 把整个 `admin-workbench` 文件夹复制到电脑
3. 打开终端，进入文件夹：`cd admin-workbench`
4. 安装依赖：`npm install`
5. 启动服务：`npm start`
6. 安装 ngrok：[ngrok.com](https://ngrok.com) 注册，下载客户端
7. 运行：`ngrok http 8080`
8. ngrok 会给一个 `https://xxx.ngrok-free.app` 的临时网址
9. 这个网址每次重启会变，如果要固定需要付费

---

## 方案四：云服务器（最稳定）

如果你有阿里云/腾讯云/AWS 的免费试用资格，可以在云服务器上部署：

```bash
# 连接到服务器后
sudo apt update && sudo apt install -y nodejs npm git
git clone https://github.com/你的用户名/admin-workbench.git
cd admin-workbench
npm install
npm start
```

然后用 `pm2` 让服务后台运行：

```bash
npm install -g pm2
pm2 start server.js --name workbench
pm2 startup
pm2 save
```

---

## 常见问题

**Q: 数据迁移怎么做？**
部署成功后，访问你的网址，用之前的账号登录。页面顶部有「迁移本机数据」按钮，可以把当前浏览器里的本地数据上传到服务器。

**Q: 忘记了账号密码怎么办？**
目前版本没有找回密码功能。如果忘了，可以重新注册一个账号。后续可以找我加这个功能。

**Q: 可以在手机上用吗？**
可以，手机浏览器打开同一个网址即可，登录后数据同步。

**Q: 部署后还能改代码吗？**
可以。改完代码后推送到 GitHub，Railway/Render 会自动重新部署。
