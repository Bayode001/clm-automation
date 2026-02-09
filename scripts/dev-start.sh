#!/bin/bash

# Start CLM Automation in development mode

echo "Starting CLM Automation in development mode..."

# Start backend
echo "Starting backend API..."
cd ../backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start frontend
echo "Starting frontend application..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "Applications running:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C to stop both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2> /dev/null; exit" SIGINT

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
