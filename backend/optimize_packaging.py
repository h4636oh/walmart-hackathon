import random
import math
import numpy as np
from copy import deepcopy
from matplotlib import pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection


NOT_DEFINED = "not defined"
INFEASIBLE = "infeasible"


class Block:
    def __init__(
        self,
        id,
        length: int,
        width: int,
        height: int,
        weight,
        customer_id,
        fragility=0,
        priority=0,
        orientations=[],
    ):
        self.id = id
        self.dimensions = (length, width, height)
        self.weight = weight
        self.customer_id = customer_id
        self.priority = priority

        # Only allow orientation with largest face area as base (most stable)
        possible_orientations = [
            (length, width, height),  # original
            (width, length, height),  # rotated 90
            (length, height, width),  # different face as base
            (width, height, length),
            (height, length, width),
            (height, width, length),
        ]

        self.allowed_orientations = sorted(
            possible_orientations, key=lambda x: x[0] * x[1]
        )
        self.volume = length * width * height
        self.fragility = fragility
        self.color = (random.random(), random.random(), random.random(), 0.5)


class container_solution:
    def __init__(self):
        self.placement = []
        self.score = NOT_DEFINED


class position:
    def __init__(self, box, x, y, z):
        self.placed_box = box
        self.x = x
        self.y = y
        self.z = z
        self.center_of_gravity = (
            x + box.dimensions[0] / 2,
            y + box.dimensions[1] / 2,
            z + box.dimensions[2] / 2,
        )


class System:
    def __init__(self, boxes, container_dims, max_weight, zone_range, zone_weights):
        self.original_boxes = boxes
        self.container_dims = container_dims
        self.max_weight = max_weight
        self.zone_range = zone_range
        self.zone_weights = zone_weights
        self.min_block_dim = min(self.container_dims)
        self.total_weight = sum(b.weight for b in self.original_boxes)
        self.fig = None
        self.ax = None

    def run_rch(self, num_iterations=10, visualize=False):
        solutions = []
        for _ in range(num_iterations):
            blocks = self.original_boxes
            sorted_blocks = self.sort_and_randomize(blocks)
            container = self.constructive_packing(sorted_blocks, visualize)
            solution = self.evaluate(container)
            solutions.append(container)

            if visualize:
                self.visualize_3d(container)

        solution = self.sort_solutions(solutions)

        if visualize:
            self.visualize_3d(solution)

        return self.format_to_3d_array(solution)

    def initial_feasibility(self):
        total_volume = sum(b.volume for b in self.original_boxes)
        return self.total_weight <= self.max_weight and total_volume <= math.prod(
            self.container_dims
        )

    def sort_and_randomize(self, blocks):
        def sort_key(block):
            # Sort by customer, then priority, then volume (descending)
            return (block.customer_id, block.priority, -block.volume)

        block_copy = blocks.copy()
        block_copy.sort(key=sort_key, reverse=True)

        for i in range(len(blocks) - 1):
            if random.random() < 0.1:  # 10% chance to swap
                blocks[i], blocks[i + 1] = blocks[i + 1], blocks[i]
        return block_copy

    def constructive_packing(self, blocks, visualize=False):
        potential_points = {(0, 0, 0)}
        covered_points = set()
        container_object = container_solution()

        def fits_in_container(orientation, x, y, z):
            return (
                x + orientation[0] <= self.container_dims[0]
                and y + orientation[1] <= self.container_dims[1]
                and z + orientation[2] <= self.container_dims[2]
            )

        def overlap(orientation, x, y, z):
            for i in range(x, x + orientation[0]):
                for j in range(y, y + orientation[1]):
                    for k in range(z, z + orientation[2]):
                        if (i, j, k) in covered_points:
                            return True
            return False

        def has_sufficient_support(orientation, x, y, z):
            if z == 0:  # On the container floor
                return True

            # Calculate required support area (80% of base)
            required_support = 0.95 * orientation[0] * orientation[1]
            supported_area = 0

            # Check all points below the box's base
            for i in range(x, x + orientation[0]):
                for j in range(y, y + orientation[1]):
                    if (i, j, z - 1) in covered_points:
                        supported_area += 1
                        if supported_area >= required_support:
                            return True
            return False

        def find_best_position(block):
            for x, y, z in sorted(
                potential_points, key=lambda p: (p[2], p[0] + p[1])
            ):  # Prefer lower z first
                for orientation in block.allowed_orientations:
                    if (
                        fits_in_container(orientation, x, y, z)
                        and not overlap(orientation, x, y, z)
                        and has_sufficient_support(orientation, x, y, z)
                    ):
                        return (x, y, z, orientation)
            return None

        def place(block, x, y, z, orientation):
            # Update covered points
            for i in range(x, x + orientation[0]):
                for j in range(y, y + orientation[1]):
                    for k in range(z, z + orientation[2]):
                        covered_points.add((i, j, k))

            # Update potential points
            potential_points.remove((x, y, z))
            potential_points.add((x, y, z + orientation[2]))  # Top
            potential_points.add((x + orientation[0], y, z))  # Right
            potential_points.add((x, y + orientation[1], z))  # Front

            # Update block dimensions to match chosen orientation
            block.dimensions = orientation
            container_object.placement.append(position(block, x, y, z))

        temp = set()
        for block in blocks:
            best_position = find_best_position(block)
            if best_position:
                x, y, z, orientation = best_position
                place(block, x, y, z, orientation)
            else:
                temp.add(block)

        # Try placing remaining boxes again
        for block in list(temp):
            best_position = find_best_position(block)
            if best_position:
                x, y, z, orientation = best_position
                place(block, x, y, z, orientation)
                temp.remove(block)

        return container_object

    def evaluate(self, solution):
        def check_Center_of_Gravity():
            com_x, com_y, com_z = 0, 0, 0
            zones_mass_limit = self.zone_weights.copy()

            for placement in solution.placement:
                box = placement.placed_box
                com_x += box.weight * placement.x
                com_y += box.weight * placement.y
                com_z += box.weight * placement.z

                for zone_no, zone_range in enumerate(self.zone_range, start=1):
                    if placement.x >= zone_range[0] and placement.x < zone_range[1]:
                        zones_mass_limit[zone_no] -= box.weight
                        if zones_mass_limit[zone_no] < 0:
                            solution.score = INFEASIBLE
                            return INFEASIBLE

            com_x /= self.total_weight
            com_y /= self.total_weight
            com_z /= self.total_weight

            safe_x = self.container_dims[0] * 0.4
            safe_y = self.container_dims[1] * 0.4

            if (
                com_x < safe_x
                or com_x > self.container_dims[0] - safe_x
                or com_y < safe_y
                or com_y > self.container_dims[1] - safe_y
            ):
                solution.score = 0
                return solution.score

            solution.score = len(solution.placement)
            return solution.score

        return check_Center_of_Gravity()

    def sort_solutions(self, solutions):
        def sort_key(sol):
            placed_volume = (
                sum(p.placed_box.volume for p in sol.placement)
                * 100
                / self.total_weight
            )
            com_x = (
                sum(p.placed_box.weight * p.x for p in sol.placement)
                / self.total_weight
            )
            com_y = (
                sum(p.placed_box.weight * p.y for p in sol.placement)
                / self.total_weight
            )
            center_x, center_y = self.container_dims[0] / 2, self.container_dims[1] / 2
            stability_score = ((com_x - center_x) ** 2 + (com_y - center_y) ** 2) ** 0.5
            return (
                placed_volume,
                -stability_score,
            )  # Maximize volume, minimize stability score

        return max(solutions, key=sort_key) if solutions else None

    def format_to_3d_array(self, solution):
        container_array = np.zeros(self.container_dims, dtype="U10")
        for pos in solution.placement:
            box = pos.placed_box
            x, y, z = pos.x, pos.y, pos.z
            l, w, h = box.dimensions
            container_array[x : x + l, y : y + w, z : z + h] = box.id
        return container_array.tolist()

    def visualize_3d(self, solution):
        if self.fig is None:
            self.fig = plt.figure(figsize=(12, 8))
            self.ax = self.fig.add_subplot(111, projection="3d")

        self.ax.clear()

        # Draw container
        container_corners = [
            [0, 0, 0],
            [self.container_dims[0], 0, 0],
            [self.container_dims[0], self.container_dims[1], 0],
            [0, self.container_dims[1], 0],
            [0, 0, self.container_dims[2]],
            [self.container_dims[0], 0, self.container_dims[2]],
            [self.container_dims[0], self.container_dims[1], self.container_dims[2]],
            [0, self.container_dims[1], self.container_dims[2]],
        ]

        # Draw container edges
        edges = [
            [
                container_corners[0],
                container_corners[1],
                container_corners[2],
                container_corners[3],
            ],
            [
                container_corners[4],
                container_corners[5],
                container_corners[6],
                container_corners[7],
            ],
            [container_corners[0], container_corners[4]],
            [container_corners[1], container_corners[5]],
            [container_corners[2], container_corners[6]],
            [container_corners[3], container_corners[7]],
        ]

        for edge in edges:
            if len(edge) == 4:
                poly = Poly3DCollection([edge], alpha=0.1, linewidths=1, edgecolor="k")
                poly.set_facecolor("lightgray")
                self.ax.add_collection3d(poly)
            else:
                xs, ys, zs = zip(*edge)
                self.ax.plot(xs, ys, zs, color="k", linewidth=1)

        # Draw boxes
        for pos in solution.placement:
            box = pos.placed_box
            x, y, z = pos.x, pos.y, pos.z
            l, w, h = box.dimensions

            corners = [
                [x, y, z],
                [x + l, y, z],
                [x + l, y + w, z],
                [x, y + w, z],
                [x, y, z + h],
                [x + l, y, z + h],
                [x + l, y + w, z + h],
                [x, y + w, z + h],
            ]

            faces = [
                [corners[0], corners[1], corners[2], corners[3]],  # bottom
                [corners[4], corners[5], corners[6], corners[7]],  # top
                [corners[0], corners[1], corners[5], corners[4]],  # front
                [corners[2], corners[3], corners[7], corners[6]],  # back
                [corners[1], corners[2], corners[6], corners[5]],  # right
                [corners[0], corners[3], corners[7], corners[4]],  # left
            ]

            poly = Poly3DCollection(faces, alpha=0.7, linewidths=1, edgecolor="k")
            poly.set_facecolor(box.color)
            self.ax.add_collection3d(poly)

            self.ax.text(
                x + l / 2,
                y + w / 2,
                z + h / 2,
                str(box.id),
                color="black",
                ha="center",
                va="center",
            )

        self.ax.set_xlabel("X (Length)")
        self.ax.set_ylabel("Y (Width)")
        self.ax.set_zlabel("Z (Height)")
        self.ax.set_title("3D Container Packing Visualization")

        self.ax.set_box_aspect(
            [self.container_dims[0], self.container_dims[1], self.container_dims[2]]
        )

        total_volume = sum(b.volume for b in self.original_boxes)
        placed_volume = sum(p.placed_box.volume for p in solution.placement)
        utilization = placed_volume / math.prod(self.container_dims) * 100
        self.ax.text2D(
            0.05, 0.95, f"Utilization: {utilization:.1f}%", transform=self.ax.transAxes
        )

        plt.tight_layout()
        plt.draw()
        plt.pause(0.1)


def Optimizer(
    boxes,
    container_dims,
    max_weight=0,
    zone_range=None,
    zone_weights=None,
    visualize=False,
):
    if max_weight < 0:
        max_weight = sum(box.weight for box in boxes)
    if not zone_range:
        zone_range, zone_weights = [(0, container_dims[0])], {1: max_weight}
    system = System(boxes, container_dims, max_weight, zone_range, zone_weights)
    solution_array_3d = system.run_rch(num_iterations=30, visualize=visualize)

    if visualize:
        plt.show()

    return solution_array_3d


# def main(input_data, visualize=False):
#     container_dims = (
#         input_data["container"]["container_x"],
#         input_data["container"]["container_y"],
#         input_data["container"]["container_z"]
#     )
#     max_weight = input_data["container"]["max_weight"]

#     blocks = []
#     for box_data in input_data["boxes"]:
#         block = Block(
#             id=box_data["box_id"],
#             length=box_data["length"],
#             width=box_data["breadth"],
#             height=box_data["height"],
#             weight=box_data["weight"],
#             customer_id=box_data["customer_id"],
#             fragility=1 if box_data["fragile"] else 0
#         )
#         blocks.append(block)

#     solution = Optimizer(
#         boxes=blocks,
#         container_dims=container_dims,
#         max_weight=max_weight,
#         visualize=visualize
#     )

#     output = {
#         "shipment_id": input_data["shipment_id"],
#         "container_dimensions": container_dims,
#         "max_weight": max_weight,
#         "total_boxes": len(blocks),
#         "placed_boxes": len(solution),
#         "solution_matrix": solution
#     }

#     return output

# if __name__ == "__main__":
#     import json

#     # Load from file
#     with open("sample.json") as f:
#         input_data = json.load(f)

#     # Run with visualization
#     result = main(input_data, visualize=True)

#     # Print results
#     print(f"Placed {result['placed_boxes']} out of {result['total_boxes']} boxes")
#     print(f"Container utilization: {result['placed_boxes']/result['total_boxes']*100:.1f}%")
