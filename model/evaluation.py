from model.distance import euclidean_distance

def calculate_total(route):

    total_distance = 0
    total_bbm = 0
    total_macet = 0
    total_risiko = 0

    for i in range(len(route) - 1):

        current = route[i]
        next_point = route[i + 1]

        total_distance += euclidean_distance(
            current,
            next_point
        )

        total_bbm += next_point['bbm']
        total_macet += next_point['macet']
        total_risiko += next_point['risiko']

    return {
        "distance": round(total_distance, 2),
        "bbm": round(total_bbm, 2),
        "macet": round(total_macet, 2),
        "risiko": round(total_risiko, 2)
    }