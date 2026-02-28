#!/bin/bash
# Script to install all required Python packages for chatbot backend

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "Virtual environment activated."
else
    echo "No virtual environment found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Virtual environment created and activated."
fi

# Upgrade pip
pip install --upgrade pip

# Install all required packages
pip install flask flask_cors requests python-dotenv google-generativeai firebase-admin

echo "All backend dependencies installed!"
