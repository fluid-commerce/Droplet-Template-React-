@echo off
REM 🚀 Fluid Droplet Template - One-Command Setup (Windows)
REM This script does EVERYTHING needed to get the project running

echo 🚀 Fluid Droplet Template - One-Command Setup
echo =============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo ℹ️  Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Get Node.js version
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set NODE_MAJOR=%%i

if %NODE_MAJOR% lss 18 (
    echo ❌ Node.js version 18+ is required. You have version %NODE_VERSION%
    echo ℹ️  Please upgrade Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js %NODE_VERSION% detected

REM Install dependencies
echo ℹ️  Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

REM Run the auto-setup script
echo ℹ️  Running auto-setup...
call npm run setup
if %errorlevel% neq 0 (
    echo ❌ Auto-setup failed
    pause
    exit /b 1
)
echo ✅ Auto-setup completed

REM Final success message
echo.
echo ✅ 🎉 Setup Complete! Your Fluid Droplet Template is ready!
echo.
echo ℹ️  Next steps:
echo 1. Get your Fluid API key from https://fluid.app
echo 2. Update FLUID_API_KEY in backend\.env
echo 3. Run: npm run dev:full
echo 4. Create your droplet: FLUID_API_KEY=your_key EMBED_URL=http://localhost:3000/ node scripts/create-droplet.js
echo.
echo ℹ️  Happy coding! 🚀
pause
