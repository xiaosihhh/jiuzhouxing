@echo off
chcp 65001 >nul
title 九州行 · 本地服务器
echo.
echo   ◈ 九州行 · 本地服务器启动中...
echo   ◆ 保持本窗口开启（可最小化到任务栏）
echo   ◆ 浏览器访问 http://localhost:8000/
echo   ◆ 关闭本窗口 = 停止服务
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
echo.
echo   服务器已停止。按任意键关闭窗口...
pause >nul