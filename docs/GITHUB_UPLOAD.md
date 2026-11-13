# GitHub 上架说明

## 当前状态

本机尚未安装 Git 和 GitHub CLI，因此项目还未初始化 GitHub 仓库。

项目根目录已提供 `.gitignore`，会排除：

- `.env` 和所有本地密钥配置
- `node_modules`
- 用户账号、对话和行程数据
- 日志、临时文件和本地版本压缩包

## 推荐步骤

1. 从 <https://git-scm.com/download/win> 安装 Git。
2. 登录 GitHub，新建一个空仓库，不要勾选自动生成 README。
3. 在项目目录打开 PowerShell，执行：

```powershell
git init
git add .
git commit -m "feat: complete Jiuzhouxing competition project"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

4. 上传后检查仓库中不存在 `.env`、`data/users.json`、`data/conversations.jsonl` 或任何 AK/SK。

## 比赛提交说明

GitHub 通常不是应用运行的前置条件，但可以作为源码托管与在线展示入口。最终是否需要公开仓库，应以比赛的提交规范为准；如果规则要求保密，请创建私有仓库，并把比赛账号加入协作者。
