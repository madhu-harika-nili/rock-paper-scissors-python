from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/play", methods=["POST"])
def play():
    data = request.get_json() or {}
    user_choice = data.get("choice")
    options = ["rock", "paper", "scissor"]
    computer_choice = random.choice(options)

    if user_choice == computer_choice:
        result = "tie"
    elif (user_choice == "rock" and computer_choice == "scissor") or \
         (user_choice == "paper" and computer_choice == "rock") or \
         (user_choice == "scissor" and computer_choice == "paper"):
        result = "win"
    else:
        result = "lose"

    return jsonify({
        "user": user_choice,
        "computer": computer_choice,
        "result": result
    })

if __name__ == "__main__":
    app.run(debug=True)

