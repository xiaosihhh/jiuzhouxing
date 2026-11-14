# CodeArts 开发过程证据

本目录用于保存华为云码道 CodeArts 代码智能体参与项目开发的佐证材料。

## 已有证据

### 20261114-codearts-ide-agentarts.png

证明内容：

- IDE 识别项目 `demo` 与全部源码、截图文件。
- 界面底部明确显示“华为云码道CodeArts代码智能体”。
- 智能体模型状态为 `DeepSeek V4.1 Flash High`。
- 浏览器同时打开华为云 AgentArts Managed Agents 控制台。
- 控制台可看到智能体 `agent-nev8iia0`、运行环境和创建时间。

这属于“开发环境与云服务接入证明”，建议作为证据册第一页。

## 仍需补充的证据

1. 至少 3 次 CodeArts 开发对话，包含需求、智能体执行过程和完成结果。
2. 代码修改前后文件列表或代码差异截图。
3. 测试通过的终端输出，例如 `node tools/check-project.js` 和健康检查结果。
4. AgentArts Skill 执行记录和 Runtime 调用记录。
5. OBS、RDS、DCS 控制台截图；RDS/DCS 未完成前不得标注为已接入。
6. 页面预览和最终部署验收截图。

## 推荐命名

```text
20261114-01-codearts-environment.png
20261114-02-route-agent-request.png
20261114-03-route-agent-result.png
20261114-04-code-change.png
20261114-05-test-passed.png
20261114-06-agentarts-trace.png
```

所有截图应保留完整浏览器或 IDE 边界，并隐藏手机号、AK/SK、API Key 和账单个人信息。
