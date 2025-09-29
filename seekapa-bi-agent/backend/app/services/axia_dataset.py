"""
DS-Axia Dataset Service
Provides realistic sample data for the DS-Axia business analytics dataset
Includes sales, revenue, products, customers, and time-series data
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import random
import json
import logging

logger = logging.getLogger(__name__)

class AxiaDataset:
    """Mock DS-Axia dataset with realistic business data"""

    def __init__(self):
        self.current_date = datetime(2025, 9, 29)  # September 29, 2025
        self.initialize_data()

    def initialize_data(self):
        """Initialize all dataset components"""
        self.products = self._generate_products()
        self.customers = self._generate_customers()
        self.regions = self._generate_regions()
        self.sales_data = self._generate_sales_data()
        self.calculate_metrics()

    def _generate_products(self) -> List[Dict]:
        """Generate product catalog"""
        categories = {
            "Enterprise Software": ["ERP Suite", "CRM Platform", "Analytics Pro", "Security Suite", "Cloud Manager"],
            "Data Solutions": ["DataHub Pro", "ETL Master", "BI Dashboard", "Data Lake", "ML Platform"],
            "Cloud Services": ["Compute Plus", "Storage Unlimited", "Network Pro", "Backup Elite", "CDN Express"],
            "AI Products": ["Vision AI", "Language Model", "Predictive Analytics", "AutoML Suite", "Neural Engine"],
            "Consulting": ["Implementation", "Migration", "Optimization", "Training", "Support"]
        }

        products = []
        product_id = 1000

        for category, items in categories.items():
            for item in items:
                base_price = random.uniform(5000, 50000) if category != "Consulting" else random.uniform(1000, 10000)
                products.append({
                    "product_id": f"P{product_id}",
                    "product_name": item,
                    "category": category,
                    "base_price": round(base_price, 2),
                    "margin": random.uniform(0.3, 0.7),
                    "launch_date": self.current_date - timedelta(days=random.randint(30, 730))
                })
                product_id += 1

        return products

    def _generate_customers(self) -> List[Dict]:
        """Generate customer segments"""
        segments = {
            "Enterprise": {
                "count": 150,
                "avg_order_value": 250000,
                "order_frequency": 4,  # per year
                "retention_rate": 0.92
            },
            "SMB": {
                "count": 500,
                "avg_order_value": 50000,
                "order_frequency": 6,
                "retention_rate": 0.85
            },
            "Startup": {
                "count": 300,
                "avg_order_value": 15000,
                "order_frequency": 8,
                "retention_rate": 0.75
            },
            "Individual": {
                "count": 1000,
                "avg_order_value": 2000,
                "order_frequency": 2,
                "retention_rate": 0.65
            }
        }

        customers = []
        customer_id = 1

        for segment_name, config in segments.items():
            for i in range(config["count"]):
                customers.append({
                    "customer_id": f"C{customer_id:05d}",
                    "segment": segment_name,
                    "avg_order_value": config["avg_order_value"] * random.uniform(0.7, 1.3),
                    "lifetime_value": config["avg_order_value"] * config["order_frequency"] * random.uniform(1, 5),
                    "acquisition_date": self.current_date - timedelta(days=random.randint(30, 1095)),
                    "retention_rate": config["retention_rate"],
                    "churn_risk": random.uniform(0, 1) > config["retention_rate"]
                })
                customer_id += 1

        return customers

    def _generate_regions(self) -> List[Dict]:
        """Generate regional data"""
        return [
            {"region": "North America", "country_count": 3, "revenue_share": 0.45, "growth_rate": 0.15},
            {"region": "Europe", "country_count": 15, "revenue_share": 0.30, "growth_rate": 0.12},
            {"region": "Asia Pacific", "country_count": 10, "revenue_share": 0.20, "growth_rate": 0.25},
            {"region": "Latin America", "country_count": 8, "revenue_share": 0.03, "growth_rate": 0.18},
            {"region": "Middle East & Africa", "country_count": 12, "revenue_share": 0.02, "growth_rate": 0.22}
        ]

    def _generate_sales_data(self) -> List[Dict]:
        """Generate 2 years of sales transaction data"""
        sales = []
        transaction_id = 100000

        # Generate daily sales for 2 years (2024-2025)
        start_date = datetime(2024, 1, 1)
        end_date = self.current_date

        current_date = start_date
        while current_date <= end_date:
            # Number of transactions per day (with weekly/seasonal patterns)
            day_of_week = current_date.weekday()
            month = current_date.month

            # Weekly pattern (lower on weekends)
            weekly_multiplier = 1.0 if day_of_week < 5 else 0.6

            # Seasonal pattern (Q4 is strongest, Q1 weakest)
            seasonal_multiplier = {
                1: 0.85, 2: 0.85, 3: 0.9,  # Q1
                4: 0.95, 5: 1.0, 6: 1.0,   # Q2
                7: 0.9, 8: 0.95, 9: 1.05,  # Q3
                10: 1.15, 11: 1.2, 12: 1.25  # Q4
            }[month]

            # Growth trend (15% YoY growth)
            days_from_start = (current_date - start_date).days
            growth_multiplier = 1 + (days_from_start / 730) * 0.15

            base_transactions = 50
            num_transactions = int(base_transactions * weekly_multiplier * seasonal_multiplier * growth_multiplier)

            for _ in range(num_transactions):
                customer = random.choice(self.customers)
                product = random.choice(self.products)
                region = random.choice(self.regions)

                # Calculate sale amount with discounts
                discount = random.uniform(0, 0.2) if random.random() > 0.7 else 0
                quantity = random.randint(1, 10) if customer["segment"] != "Enterprise" else random.randint(10, 100)
                unit_price = product["base_price"] * (1 - discount)
                revenue = unit_price * quantity

                sales.append({
                    "transaction_id": f"T{transaction_id}",
                    "date": current_date.isoformat(),
                    "customer_id": customer["customer_id"],
                    "customer_segment": customer["segment"],
                    "product_id": product["product_id"],
                    "product_name": product["product_name"],
                    "product_category": product["category"],
                    "region": region["region"],
                    "quantity": quantity,
                    "unit_price": round(unit_price, 2),
                    "discount_rate": round(discount, 2),
                    "revenue": round(revenue, 2),
                    "cost": round(revenue * (1 - product["margin"]), 2),
                    "profit": round(revenue * product["margin"], 2),
                    "year": current_date.year,
                    "quarter": f"Q{(current_date.month - 1) // 3 + 1}",
                    "month": current_date.strftime("%B"),
                    "week": current_date.isocalendar()[1],
                    "day_of_week": current_date.strftime("%A")
                })
                transaction_id += 1

            # Add anomaly on specific dates (for anomaly detection feature)
            if current_date.date() in [
                datetime(2024, 3, 15).date(),  # System outage
                datetime(2024, 7, 4).date(),    # Holiday
                datetime(2024, 11, 29).date(),  # Black Friday
                datetime(2025, 3, 20).date(),   # Product launch
                datetime(2025, 6, 30).date(),   # End of fiscal year
            ]:
                # Generate anomaly transactions
                anomaly_multiplier = random.uniform(0.2, 3.0)
                for _ in range(int(num_transactions * anomaly_multiplier)):
                    # Similar transaction generation but marked as anomaly
                    sales[-1]["is_anomaly"] = True

            current_date += timedelta(days=1)

        return sales

    def calculate_metrics(self):
        """Calculate aggregate metrics"""
        # Total revenue
        self.total_revenue = sum(s["revenue"] for s in self.sales_data)

        # Revenue by time periods
        self.revenue_by_quarter = {}
        self.revenue_by_month = {}
        self.revenue_by_category = {}
        self.revenue_by_region = {}
        self.revenue_by_segment = {}

        for sale in self.sales_data:
            # By quarter
            quarter_key = f"{sale['year']}-{sale['quarter']}"
            self.revenue_by_quarter[quarter_key] = self.revenue_by_quarter.get(quarter_key, 0) + sale["revenue"]

            # By month
            month_key = f"{sale['year']}-{sale['month']}"
            self.revenue_by_month[month_key] = self.revenue_by_month.get(month_key, 0) + sale["revenue"]

            # By category
            self.revenue_by_category[sale["product_category"]] = self.revenue_by_category.get(sale["product_category"], 0) + sale["revenue"]

            # By region
            self.revenue_by_region[sale["region"]] = self.revenue_by_region.get(sale["region"], 0) + sale["revenue"]

            # By segment
            self.revenue_by_segment[sale["customer_segment"]] = self.revenue_by_segment.get(sale["customer_segment"], 0) + sale["revenue"]

    def get_total_revenue(self) -> Dict[str, Any]:
        """Get total revenue metrics"""
        return {
            "total_revenue": round(self.total_revenue, 2),
            "total_transactions": len(self.sales_data),
            "average_transaction_value": round(self.total_revenue / len(self.sales_data), 2),
            "data_period": {
                "start": "2024-01-01",
                "end": self.current_date.isoformat()
            }
        }

    def get_sales_trends(self, period: str = "quarter") -> Dict[str, Any]:
        """Get sales trends for the specified period"""
        if period == "quarter":
            # Get last 4 quarters
            quarters = sorted(self.revenue_by_quarter.keys())[-4:]
            trends = []

            for i, quarter in enumerate(quarters):
                revenue = self.revenue_by_quarter[quarter]
                if i > 0:
                    prev_revenue = self.revenue_by_quarter[quarters[i-1]]
                    growth = ((revenue - prev_revenue) / prev_revenue) * 100
                else:
                    growth = 0

                trends.append({
                    "period": quarter,
                    "revenue": round(revenue, 2),
                    "growth_percentage": round(growth, 1)
                })

            return {
                "period_type": "quarter",
                "trends": trends,
                "summary": {
                    "total_growth": round(((trends[-1]["revenue"] - trends[0]["revenue"]) / trends[0]["revenue"]) * 100, 1),
                    "avg_quarterly_growth": round(sum(t["growth_percentage"] for t in trends[1:]) / 3, 1)
                }
            }

    def get_top_products(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top performing products by revenue"""
        product_revenue = {}
        product_quantity = {}

        for sale in self.sales_data:
            product_key = sale["product_name"]
            product_revenue[product_key] = product_revenue.get(product_key, 0) + sale["revenue"]
            product_quantity[product_key] = product_quantity.get(product_key, 0) + sale["quantity"]

        # Sort by revenue and get top N
        top_products = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)[:limit]

        result = []
        for rank, (product, revenue) in enumerate(top_products, 1):
            result.append({
                "rank": rank,
                "product_name": product,
                "total_revenue": round(revenue, 2),
                "units_sold": product_quantity[product],
                "revenue_share": round((revenue / self.total_revenue) * 100, 1)
            })

        return result

    def get_yoy_comparison(self) -> Dict[str, Any]:
        """Get year-over-year comparison"""
        revenue_2024 = sum(s["revenue"] for s in self.sales_data if s["year"] == 2024)
        revenue_2025 = sum(s["revenue"] for s in self.sales_data if s["year"] == 2025)

        # Adjust 2025 for partial year (up to September 29)
        days_2025 = (self.current_date - datetime(2025, 1, 1)).days + 1
        projected_2025 = (revenue_2025 / days_2025) * 365

        return {
            "year_2024": {
                "revenue": round(revenue_2024, 2),
                "transactions": sum(1 for s in self.sales_data if s["year"] == 2024)
            },
            "year_2025_actual": {
                "revenue": round(revenue_2025, 2),
                "transactions": sum(1 for s in self.sales_data if s["year"] == 2025),
                "days_included": days_2025
            },
            "year_2025_projected": {
                "revenue": round(projected_2025, 2),
                "growth_rate": round(((projected_2025 - revenue_2024) / revenue_2024) * 100, 1)
            }
        }

    def get_customer_segments(self) -> Dict[str, Any]:
        """Get customer segment analysis"""
        segments = []

        for segment, revenue in self.revenue_by_segment.items():
            customer_count = sum(1 for c in self.customers if c["segment"] == segment)
            transactions = sum(1 for s in self.sales_data if s["customer_segment"] == segment)

            segments.append({
                "segment": segment,
                "revenue": round(revenue, 2),
                "revenue_share": round((revenue / self.total_revenue) * 100, 1),
                "customer_count": customer_count,
                "transaction_count": transactions,
                "avg_transaction_value": round(revenue / transactions, 2) if transactions > 0 else 0
            })

        return {
            "segments": sorted(segments, key=lambda x: x["revenue"], reverse=True),
            "total_customers": len(self.customers),
            "total_revenue": round(self.total_revenue, 2)
        }

    def get_revenue_forecast(self) -> Dict[str, Any]:
        """Generate revenue forecast for next quarter"""
        # Get recent trends
        recent_quarters = sorted(self.revenue_by_quarter.keys())[-4:]
        recent_revenues = [self.revenue_by_quarter[q] for q in recent_quarters]

        # Calculate growth trend
        growth_rates = []
        for i in range(1, len(recent_revenues)):
            growth = (recent_revenues[i] - recent_revenues[i-1]) / recent_revenues[i-1]
            growth_rates.append(growth)

        avg_growth = sum(growth_rates) / len(growth_rates)

        # Forecast Q4 2025
        last_revenue = recent_revenues[-1]
        q4_forecast = last_revenue * (1 + avg_growth)

        # Add seasonal adjustment (Q4 typically 20% higher)
        q4_forecast *= 1.2

        return {
            "forecast_period": "2025-Q4",
            "predicted_revenue": round(q4_forecast, 2),
            "confidence_interval": {
                "low": round(q4_forecast * 0.9, 2),
                "high": round(q4_forecast * 1.1, 2)
            },
            "growth_rate": round(avg_growth * 100, 1),
            "factors": [
                "Historical growth trend: +15% YoY",
                "Seasonal Q4 uplift: +20%",
                "Current pipeline strength: Strong",
                "Market conditions: Favorable"
            ]
        }

    def detect_anomalies(self) -> Dict[str, Any]:
        """Detect anomalies in the dataset"""
        anomalies = []

        # Group sales by date
        sales_by_date = {}
        for sale in self.sales_data:
            date = sale["date"][:10]
            if date not in sales_by_date:
                sales_by_date[date] = {"revenue": 0, "transactions": 0}
            sales_by_date[date]["revenue"] += sale["revenue"]
            sales_by_date[date]["transactions"] += 1

        # Calculate mean and std
        daily_revenues = [d["revenue"] for d in sales_by_date.values()]
        mean_revenue = sum(daily_revenues) / len(daily_revenues)
        std_revenue = (sum((r - mean_revenue) ** 2 for r in daily_revenues) / len(daily_revenues)) ** 0.5

        # Identify anomalies (>2 std from mean)
        for date, metrics in sales_by_date.items():
            z_score = abs((metrics["revenue"] - mean_revenue) / std_revenue)
            if z_score > 2:
                anomaly_type = "spike" if metrics["revenue"] > mean_revenue else "drop"
                anomalies.append({
                    "date": date,
                    "revenue": round(metrics["revenue"], 2),
                    "transactions": metrics["transactions"],
                    "z_score": round(z_score, 2),
                    "type": anomaly_type,
                    "severity": "high" if z_score > 3 else "medium"
                })

        # Sort by date
        anomalies = sorted(anomalies, key=lambda x: x["date"], reverse=True)[:10]

        return {
            "anomalies_detected": len(anomalies),
            "analysis_period": {
                "start": "2024-01-01",
                "end": self.current_date.isoformat()
            },
            "detection_method": "Statistical (Z-score > 2)",
            "anomalies": anomalies,
            "recommendations": [
                "Investigate Black Friday spike on 2024-11-29",
                "Review system outage impact on 2024-03-15",
                "Analyze product launch success on 2025-03-20",
                "Monitor end-of-fiscal-year patterns"
            ]
        }

# Singleton instance
_dataset_instance = None

def get_axia_dataset() -> AxiaDataset:
    """Get or create the Axia dataset singleton"""
    global _dataset_instance
    if _dataset_instance is None:
        _dataset_instance = AxiaDataset()
        logger.info("Initialized DS-Axia dataset with sample data")
    return _dataset_instance