import math

from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver import routing_enums_pb2

def euclidean_distance(a, b):

    return math.sqrt(
        (a['lat'] - b['lat'])**2 +
        (a['lng'] - b['lng'])**2
    )

def build_cost_matrix(start, points):

    nodes = [start] + points

    matrix = []

    for i in range(len(nodes)):

        row = []

        for j in range(len(nodes)):

            if i == j:

                row.append(0)

            else:

                distance = euclidean_distance(
                    nodes[i],
                    nodes[j]
                )

                penalty = (
                    30 * nodes[j]['bbm'] +
                    20 * nodes[j]['macet'] +
                    10 * nodes[j]['risiko']
                )

                cost = distance + penalty

                row.append(int(cost * 100))

        matrix.append(row)

    return matrix, nodes

def optimize_route(start, points):

    cost_matrix, nodes = build_cost_matrix(
        start,
        points
    )

    manager = pywrapcp.RoutingIndexManager(
        len(cost_matrix),
        1,
        0
    )

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):

        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)

        return cost_matrix[from_node][to_node]

    transit_callback_index = (
        routing.RegisterTransitCallback(
            distance_callback
        )
    )

    routing.SetArcCostEvaluatorOfAllVehicles(
        transit_callback_index
    )

    search_parameters = (
        pywrapcp.DefaultRoutingSearchParameters()
    )

    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    solution = routing.SolveWithParameters(
        search_parameters
    )

    route = []

    index = routing.Start(0)

    while not routing.IsEnd(index):

        node_index = manager.IndexToNode(index)

        route.append(nodes[node_index])

        index = solution.Value(
            routing.NextVar(index)
        )

    route.append(start)
    return route