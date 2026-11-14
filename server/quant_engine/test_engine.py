import unittest

from engine import fit_yield_curve


class YieldCurveRangeTests(unittest.TestCase):
    def test_short_bill_inputs_do_not_create_long_bond_points(self):
        maturities = [91 / 365, 182 / 365, 364 / 365]
        observed_yields = [8.75, 8.90, 9.05]

        curve = fit_yield_curve(maturities, observed_yields)

        self.assertEqual([point["tenor"] for point in curve], ["91D", "182D", "364D"])
        self.assertEqual([point["yield"] for point in curve], [8.75, 8.9, 9.05])
        self.assertTrue(all(point["tau_years"] <= max(maturities) for point in curve))

    def test_longer_points_appear_only_when_supported_by_observations(self):
        maturities = [91 / 365, 182 / 365, 364 / 365, 2.0, 5.0]
        observed_yields = [8.75, 8.9, 9.05, 10.2, 11.0]

        curve = fit_yield_curve(maturities, observed_yields)
        tenors = [point["tenor"] for point in curve]

        self.assertEqual(tenors, ["91D", "182D", "364D", "2Y", "5Y"])
        self.assertNotIn("10Y", tenors)
        self.assertNotIn("30Y", tenors)

    def test_unsorted_observations_are_sorted_as_matched_pairs(self):
        curve = fit_yield_curve(
            [364 / 365, 91 / 365, 182 / 365],
            [9.05, 8.75, 8.90],
        )

        self.assertEqual(
            [point["yield"] for point in curve],
            [8.75, 8.9, 9.05],
        )

    def test_invalid_or_duplicate_inputs_are_not_interpolated(self):
        self.assertEqual(fit_yield_curve([0.25], [8.0]), [])
        self.assertEqual(fit_yield_curve([0.25, 0.5], [8.0]), [])
        self.assertEqual(fit_yield_curve([0.25, 0.25], [8.0, 8.5]), [])
        self.assertEqual(fit_yield_curve([0.25, float("nan")], [8.0, 8.5]), [])


if __name__ == "__main__":
    unittest.main()
