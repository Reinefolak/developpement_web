@echo off
chcp 65001 > nul
title Envoi de votre site vers GitHub
cd /d "%~dp0"

echo =======================================================
echo   ENVOI DE VOTRE SITE VERS GITHUB EN COURS...
echo =======================================================
echo.

git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://github.com/SMILE-web2026/Developpement_web.git
git push -u origin main

echo.
echo =======================================================
echo   OPERATION TERMINEE AVEC SUCCES !
echo =======================================================
pause
