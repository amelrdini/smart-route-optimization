from flask import Flask, render_template, request, jsonify
import math
import pandas as pd
import numpy as np
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__)

# Load CSV sekali saat startup
csv_path = 'data/supply_chain_logistic.csv'
df = None

try:
    df = pd.read_csv(csv_path, sep=';')
    
    # Data cleaning untuk latitude dan longitude
    df['latitude'] = df['latitude'].astype(str).str.replace('.', '', regex=False)
    df['longitude'] = df['longitude'].astype(str).str.replace('.', '', regex=False)
    df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
    
    df['latitude'] = df['latitude'] / 1e15
    df['longitude'] = df['longitude'] / 1e15
    
    # Data cleaning untuk kolom metrics (remove dots, convert to numeric)
    metrics_cols = ['penggunaan_bbm', 'tingkat_kemacetan', 'risiko_pengiriman']
    for col in metrics_cols:
        df[col] = df[col].astype(str).str.replace('.', '', regex=False)
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Drop rows dengan NaN values
    df = df.dropna()
    
    # Sample 15 data points (atau semua jika kurang dari 15)
    if len(df) > 15:
        df = df.sample(n=15, random_state=42).reset_index(drop=True)
    else:
        df = df.reset_index(drop=True)
    
    print(f"CSV loaded successfully: {len(df)} locations")
    print(f"Data types: {df.dtypes.to_dict()}")
except Exception as e:
    print(f"Error loading CSV: {e}")
    df = None

@app.route('/')
def index():
    return render_template('index.html')

# Haversine distance
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# Euclidean distance untuk manual input
def distance(a, b):
    return math.sqrt((a['lat']-b['lat'])**2 + (a['lng']-b['lng'])**2)

# Cost function
def cost(a, b):
    jarak = distance(a, b)
    return (
        0.4 * jarak +
        0.3 * b['bbm'] +
        0.2 * b['macet'] +
        0.1 * b['risiko']
    )

# TSP solver dengan greedy nearest neighbor
def solve_tsp(cost_matrix):
    n = len(cost_matrix)
    visited = [False] * n
    route = [0]
    visited[0] = True
    
    for _ in range(n - 1):
        last = route[-1]
        next_city = min(
            [(cost_matrix[last][j], j) for j in range(n) if not visited[j]]
        )[1]
        route.append(next_city)
        visited[next_city] = True
    
    route.append(0)
    return route

# MANUAL ROUTE OPTIMIZATION
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

    # INPUT ORDER ROUTE (MERAH) - sesuai urutan input user
    input_order_route = [start] + points + [start]

    # OPTIMIZED ROUTE (BIRU) - urutan optimal berdasarkan cost function
    optimized_route = [start]
    current = start
    remaining = points.copy()

    while remaining:
        nearest = min(remaining, key=lambda x: cost(current, x))
        optimized_route.append(nearest)
        current = nearest
        remaining.remove(nearest)

    optimized_route.append(start)

    return jsonify({
        "input_order": input_order_route,
        "optimized": optimized_route
    })

# DASHBOARD - Get modeling results dari CSV
@app.route('/dashboard', methods=['GET'])
def dashboard():
    if df is None:
        return jsonify({"error": "CSV tidak berhasil dimuat"}), 400
    
    n = len(df)
    
    # Hitung distance matrix dengan haversine
    distance_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i != j:
                distance_matrix[i][j] = haversine(
                    df.loc[i, 'latitude'], df.loc[i, 'longitude'],
                    df.loc[j, 'latitude'], df.loc[j, 'longitude']
                )
    
    # Cost matrix berdasarkan model
    cost_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i != j:
                try:
                    bbm_val = float(df.loc[j, 'penggunaan_bbm']) * 100
                    macet_val = float(df.loc[j, 'tingkat_kemacetan']) * 100
                    risiko_val = float(df.loc[j, 'risiko_pengiriman']) * 100
                    
                    cost_matrix[i][j] = (
                        0.4 * distance_matrix[i][j] +
                        0.3 * bbm_val +
                        0.2 * macet_val +
                        0.1 * risiko_val
                    )
                except:
                    cost_matrix[i][j] = distance_matrix[i][j]
    
    # TSP routes
    route_distance = solve_tsp(distance_matrix)
    route_optimized = solve_tsp(cost_matrix)
    
    # Hitung total metrics
    def calculate_metrics(route, dist_matrix, cost_mat):
        total_distance = 0
        total_bbm = 0
        total_macet = 0
        total_risiko = 0
        
        for i in range(len(route) - 1):
            from_node = route[i]
            to_node = route[i + 1]
            total_distance += dist_matrix[from_node][to_node]
            
            try:
                total_bbm += float(df.loc[to_node, 'penggunaan_bbm'])
                total_macet += float(df.loc[to_node, 'tingkat_kemacetan'])
                total_risiko += float(df.loc[to_node, 'risiko_pengiriman'])
            except:
                pass
        
        # Normalize large numbers (divide by 1e10 untuk readable format)
        bbm_normalized = max(0.01, total_bbm / 1e10)
        macet_normalized = max(0.01, total_macet / 1e10)
        risiko_normalized = max(0.01, total_risiko / 1e10)
        
        return {
            "distance": round(total_distance, 2),
            "bbm": round(bbm_normalized, 2),
            "macet": round(macet_normalized, 2),
            "risiko": round(risiko_normalized, 2)
        }
    
    metrics_distance = calculate_metrics(route_distance, distance_matrix, cost_matrix)
    metrics_optimized = calculate_metrics(route_optimized, distance_matrix, cost_matrix)
    
    # Efficiency improvement
    distance_improvement = round(
        ((metrics_distance['distance'] - metrics_optimized['distance']) / metrics_distance['distance'] * 100), 
        2
    )
    
    # Data untuk chart
    routes_data = {
        "distance_route": {
            "label": "Shortest Distance",
            "metrics": metrics_distance,
            "route": route_distance.copy()
        },
        "optimized_route": {
            "label": "Optimized Route",
            "metrics": metrics_optimized,
            "route": route_optimized.copy()
        },
        "improvement": distance_improvement,
        "dataset_size": n
    }
    
    return jsonify(routes_data)

if __name__ == '__main__':
    app.run(debug=True)
