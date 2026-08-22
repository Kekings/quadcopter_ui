import numpy as np


class MagnetometerCalibration:

    def __init__(self):
        self.X = []
        self.Y = []
        self.Z = []
        self.result = None

    def reset(self):
        self.X.clear()
        self.Y.clear()
        self.Z.clear()
        self.result = None

    def add_sample(self, x, y, z):
        self.X.append(float(x))
        self.Y.append(float(y))
        self.Z.append(float(z))

    def sample_count(self):
        return len(self.X)

    def calibrate(self):
        if len(self.X) < 10:
            return None

        X = np.array(self.X)
        Y = np.array(self.Y)
        Z = np.array(self.Z)

        X_col = X.reshape(-1, 1)
        Y_col = Y.reshape(-1, 1)
        Z_col = Z.reshape(-1, 1)

        M = np.column_stack((
            X_col * X_col,
            Y_col * Y_col,
            Z_col * Z_col,
            X_col * Y_col,
            X_col * Z_col,
            Y_col * Z_col,
            X_col,
            Y_col,
            Z_col,
            np.ones_like(X_col)
        ))

        _, _, Vt = np.linalg.svd(M)
        params = Vt[-1, :]

        A, B, C, D, E, F, G, H, I, J = params

        Q = np.array([
            [A, D / 2, E / 2],
            [D / 2, B, F / 2],
            [E / 2, F / 2, C]
        ])

        p = np.array([G, H, I])

        center = -0.5 * np.linalg.inv(Q).dot(p)

        K = -J + center.dot(Q.dot(center))

        eigenvalues, eigenvectors = np.linalg.eigh(Q)

        scales = np.sqrt(
            np.abs(eigenvalues) / np.abs(K)
        )

        scale_matrix = np.diag(scales)

        correction_matrix = (
            eigenvectors
            @ scale_matrix
            @ eigenvectors.T
        )

        self.result = {
            "hardIron": center.tolist(),
            "softIron": correction_matrix.tolist()
        }

        return self.result

    def corrected_data(self):
        if not self.result:
            return None

        center = np.array(self.result["hardIron"])
        matrix = np.array(self.result["softIron"])

        X = np.array(self.X) - center[0]
        Y = np.array(self.Y) - center[1]
        Z = np.array(self.Z) - center[2]

        corrected = matrix @ np.vstack((X, Y, Z))

        return {
            "x": corrected[0].tolist(),
            "y": corrected[1].tolist(),
            "z": corrected[2].tolist()
        }

    def get_result(self):
        return self.result