# GitHub 上架说明

## 当前状态

Git 与 GitHub CLI 已安装，本地 `main` 分支已完成提交，线上 GitHub 仓库等待账号授权后创建。

项目根目录已提供 `.gitignore`，会排除：

- `.env` 和所有本地密钥配置
- `node_modules`
- 用户账号、对话和行程数据
- 日志、临时文件和本地版本压缩包

## 授权后执行

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh repo create jiuzhouxing-ai-travel --public --source . --remote origin --push
```

上传后检查仓库中不存在 `.env`、`data/users.json`、`data/conversations.jsonl` 或任何 AK/SK。

## 比赛提交说明

GitHub 通常不是应用运行的前置条件，但可以作为源码托管与在线展示入口。最终是否需要公开仓库，应以比赛的提交规范为准；如果规则要求保密，请创建私有仓库，并把比赛账号加入协作者。
