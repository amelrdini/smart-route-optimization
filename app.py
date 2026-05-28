from flask import Flask, render_template, request, jsonify
import math

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

# jarak euclidean sederhana
def distance(a, b):
    return math.sqrt((a['lat']-b['lat'])**2 + (a['lng']-b['lng'])**2)

# COST FUNCTION (MODEL KAMU)
def cost(a, b):
    jarak = distance(a, b)

    return (
        0.4 * jarak +
        0.3 * b['bbm'] +
        0.2 * b['macet'] +
        0.1 * b['risiko']
    )

@app.route('/optimize', methods=['POST'])
def optimize():
    data = request.get_json()

    start = {
        "lat": data['start'][0],
        "lng": data['start'][1],
        "bbm": 0,
        "macet": 0,
        "risiko": 0
    }

    points = data['points']

    # baseline (urutan input)
    baseline = [start] + points + [start]

    # optimasi (pakai cost)
    route = [start]
    current = start
    remaining = points.copy()

    while remaining:
        nearest = min(remaining, key=lambda x: cost(current, x))
        route.append(nearest)
        current = nearest
        remaining.remove(nearest)

    route.append(start)

    return jsonify({
        "baseline": baseline,
        "optimized": route
    })

if __name__ == '__main__':
    app.run(debug=True)