import math

def euclidean_distance(a, b):

    return math.sqrt(
        (a['lat'] - b['lat'])**2 +
        (a['lng'] - b['lng'])**2
    )