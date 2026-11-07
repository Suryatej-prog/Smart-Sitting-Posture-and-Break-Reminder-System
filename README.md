# Smart Sitting Posture and Break Reminder System

IoT mini project: an ESP32-based smart chair monitor that detects whether someone is sitting (FSR 402 pressure sensor), estimates posture from body distance (HC-SR04 ultrasonic), warns about slouching (LED), reminds the user to take breaks (buzzer), and reports everything to a web dashboard.

Flow: Sensors -> ESP32 -> MQTT -> Backend (Node.js/Express + MongoDB) -> Web dashboard

See `backend/README.md` for backend setup, the MQTT contract, and API docs.
