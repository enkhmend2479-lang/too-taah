import os
import random
import re
from datetime import timedelta

from flask import Flask, jsonify, render_template, request, session

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-me")
app.permanent_session_lifetime = timedelta(days=365)  # амжилт 1 жил хадгалагдана

LEVELS = {
    "easy": {"label": "Easy", "max": 50, "mult": 1},
    "medium": {"label": "Medium", "max": 100, "mult": 2},
    "hard": {"label": "Hard", "max": 500, "mult": 3},
}
DEFAULT_LEVEL = "medium"
MESSAGES = {
    "low": "Хэт бага байна",
    "high": "Хэт их байна",
    "win": "Баяр хүргэе! Та зөв таалаа!",
}


def start_game(level):
    """Шинэ тоглоом эхлүүлж, санамсаргүй тоог session-д хадгална."""
    session.permanent = True
    session["game"] = {
        "level": level,
        "target": random.randint(1, LEVELS[level]["max"]),
        "history": [],
        "over": False,
        "points": 0,
    }
    return session["game"]


def get_game():
    game = session.get("game")
    if not game or game.get("level") not in LEVELS:
        game = start_game(DEFAULT_LEVEL)
    return game


def public_state(game):
    """Хэрэглэгч рүү илгээх төлөв. Тоглоом дуусах хүртэл хариултыг нууцлана."""
    return {
        "level": game["level"],
        "max": LEVELS[game["level"]]["max"],
        "history": game["history"],
        "over": game["over"],
        "answer": game["target"] if game["over"] else None,
        "points": game["points"],
        "total": session.get("total", 0),
        "wins": session.get("wins", 0),
        "best": session.get("best", {}),
    }


def parse_guess(raw):
    """Оролтыг бүхэл тоо болгоно. Буруу бол None."""
    if raw is None or isinstance(raw, (bool, float)):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, str) and re.fullmatch(r"\d{1,6}", raw.strip()):
        return int(raw.strip())
    return None


def heat(diff, max_value):
    if diff <= max_value * 0.05:
        return "hot"
    if diff <= max_value * 0.15:
        return "warm"
    return "cold"


def error(message):
    return jsonify(ok=False, error=message), 400


@app.get("/")
def index():
    return render_template("index.html", levels=LEVELS)


@app.get("/api/state")
def api_state():
    return jsonify(ok=True, state=public_state(get_game()))


@app.post("/api/new")
def api_new():
    data = request.get_json(silent=True) or {}
    level = data.get("level", get_game()["level"])
    if level not in LEVELS:
        return error("Түвшин буруу байна.")
    return jsonify(ok=True, state=public_state(start_game(level)))


@app.post("/api/guess")
def api_guess():
    game = get_game()
    cfg = LEVELS[game["level"]]
    if game["over"]:
        return error("Тоглоом дууссан байна. Шинэ тоглоом эхлүүлнэ үү.")

    raw = (request.get_json(silent=True) or {}).get("guess")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return error("Тоогоо оруулна уу.")
    guess = parse_guess(raw)
    if guess is None:
        return error("Зөвхөн бүхэл тоо оруулна уу.")
    if not 1 <= guess <= cfg["max"]:
        return error(f"1-ээс {cfg['max']} хүртэлх тоо оруулна уу.")
    if any(h["guess"] == guess for h in game["history"]):
        return error(f"{guess} гэж аль хэдийн таасан байна.")

    target = game["target"]
    result = "win" if guess == target else ("low" if guess < target else "high")
    game["history"].append(
        {"guess": guess, "result": result, "heat": heat(abs(guess - target), cfg["max"])}
    )

    if result == "win":
        attempts = len(game["history"])
        points = max(10, 110 - 10 * attempts) * cfg["mult"]  # цөөн оролдлого = өндөр оноо
        game["over"], game["points"] = True, points
        best = session.get("best", {})
        prev = best.get(game["level"])
        if not prev or points > prev["score"]:
            best[game["level"]] = {"score": points, "attempts": attempts}
        session["best"] = best
        session["total"] = session.get("total", 0) + points
        session["wins"] = session.get("wins", 0) + 1

    session["game"] = game
    session.modified = True
    return jsonify(ok=True, result=result, message=MESSAGES[result], state=public_state(game))


if __name__ == "__main__":
    app.run(debug=True)
