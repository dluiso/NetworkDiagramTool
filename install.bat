@echo off
title NetDiagram - Instalacion de dependencias
color 0B

cd /d "%~dp0"

echo.
echo  NetDiagram - Instalacion de dependencias
echo  =========================================
echo.

:: Backend
echo [1/3] Instalando dependencias del backend (Python)...
cd backend

:: Create virtual environment
if not exist "venv" (
    echo     Creando entorno virtual Python...
    python -m venv venv
)

:: Activate venv and install
echo     Instalando paquetes Python...
call venv\Scripts\activate.bat
pip install -r requirements.txt --upgrade

if errorlevel 1 (
    echo.
    echo  ERROR: Fallo la instalacion de dependencias Python.
    echo  Intentando instalar sin bcrypt (compatibilidad Python 3.14)...
    pip install fastapi uvicorn[standard] sqlalchemy python-multipart PyJWT pydantic pydantic-settings python-dotenv aiofiles
    pip install passlib
    echo     Nota: Se usara hashlib como fallback para passwords.
)

cd ..

:: Frontend
echo.
echo [2/3] Instalando dependencias del frontend (Node.js)...
cd frontend
call npm install

if errorlevel 1 (
    echo  ERROR: Fallo npm install. Intentando con --legacy-peer-deps...
    call npm install --legacy-peer-deps
)

cd ..

echo.
echo [3/3] Verificando instalacion...
echo.

:: Check backend
cd backend
call venv\Scripts\activate.bat
python -c "import fastapi; import uvicorn; import sqlalchemy; print('  Backend OK')" 2>nul || echo "  Backend: revisar errores arriba"
cd ..

:: Check frontend
cd frontend
if exist "node_modules\react\package.json" (
    echo   Frontend OK
) else (
    echo   Frontend: revisar errores arriba
)
cd ..

echo.
echo  Instalacion completada!
echo  Ejecuta start.bat para iniciar la aplicacion.
echo.
pause
