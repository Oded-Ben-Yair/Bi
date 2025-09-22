"""Query Analyzer for understanding user intents"""

import re
from typing import Dict, List, Tuple, Optional


class QueryAnalyzer:
    """Analyze user queries to understand intent and extract entities"""

    def __init__(self):
        self.time_patterns = [
            (r'\b(last|past)\s+(\d+)\s+(day|week|month|year)s?\b', 'relative_time'),
            (r'\b(this|current)\s+(week|month|quarter|year)\b', 'current_period'),
            (r'\b(YTD|MTD|QTD|YoY|MoM|QoQ)\b', 'time_comparison'),
            (r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\b', 'month'),
            (r'\b(Q[1-4])\s+\d{4}\b', 'quarter_year'),
            (r'\b\d{4}\b', 'year')
        ]

        self.metric_keywords = [
            'revenue', 'sales', 'profit', 'cost', 'expense', 'margin',
            'growth', 'volume', 'quantity', 'amount', 'total', 'average',
            'count', 'sum', 'percentage', 'rate', 'ratio'
        ]

        self.analysis_intents = {
            'comparison': ['compare', 'versus', 'vs', 'difference', 'against'],
            'trend': ['trend', 'pattern', 'over time', 'timeline', 'historical'],
            'ranking': ['top', 'bottom', 'best', 'worst', 'highest', 'lowest', 'rank'],
            'aggregation': ['total', 'sum', 'average', 'mean', 'median', 'count'],
            'detail': ['breakdown', 'detail', 'drill down', 'by', 'per', 'each'],
            'forecast': ['forecast', 'predict', 'projection', 'estimate', 'future']
        }

    def analyze(self, query: str) -> Dict:
        """
        Analyze a query and extract relevant information

        Args:
            query: User query string

        Returns:
            Analysis results dictionary
        """
        query_lower = query.lower()

        return {
            'original_query': query,
            'intent': self._detect_intent(query_lower),
            'time_references': self._extract_time_references(query),
            'metrics': self._extract_metrics(query_lower),
            'entities': self._extract_entities(query),
            'requires_calculation': self._requires_calculation(query_lower),
            'complexity_indicators': self._get_complexity_indicators(query_lower)
        }

    def _detect_intent(self, query: str) -> List[str]:
        """Detect the primary intents of the query"""
        detected_intents = []

        for intent, keywords in self.analysis_intents.items():
            if any(keyword in query for keyword in keywords):
                detected_intents.append(intent)

        # Default intent if none detected
        if not detected_intents:
            if '?' in query:
                detected_intents.append('question')
            else:
                detected_intents.append('general')

        return detected_intents

    def _extract_time_references(self, query: str) -> List[Dict]:
        """Extract time-related references from the query"""
        time_refs = []

        for pattern, time_type in self.time_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                time_refs.append({
                    'text': match.group(0),
                    'type': time_type,
                    'position': match.span()
                })

        return time_refs

    def _extract_metrics(self, query: str) -> List[str]:
        """Extract metric keywords from the query"""
        found_metrics = []

        for metric in self.metric_keywords:
            if metric in query:
                found_metrics.append(metric)

        return found_metrics

    def _extract_entities(self, query: str) -> Dict[str, List[str]]:
        """Extract business entities from the query"""
        entities = {
            'products': [],
            'regions': [],
            'customers': [],
            'dimensions': []
        }

        # Simple pattern matching for common entities
        # In production, this could use NER (Named Entity Recognition)

        # Look for quoted strings as potential entity names
        quoted_pattern = r'"([^"]*)"'
        quoted_matches = re.findall(quoted_pattern, query)
        if quoted_matches:
            entities['dimensions'].extend(quoted_matches)

        # Look for common business terms
        if 'product' in query.lower():
            entities['dimensions'].append('product')
        if 'customer' in query.lower():
            entities['dimensions'].append('customer')
        if 'region' in query.lower() or 'location' in query.lower():
            entities['dimensions'].append('region')

        return entities

    def _requires_calculation(self, query: str) -> bool:
        """Determine if the query requires calculation"""
        calculation_indicators = [
            'calculate', 'compute', 'what is', 'how much', 'how many',
            'total', 'average', 'sum', 'percentage', 'growth rate'
        ]

        return any(indicator in query for indicator in calculation_indicators)

    def _get_complexity_indicators(self, query: str) -> List[str]:
        """Get indicators of query complexity"""
        indicators = []

        # Multiple metrics
        metric_count = len(self._extract_metrics(query))
        if metric_count > 2:
            indicators.append(f"multiple_metrics_{metric_count}")

        # Multiple time periods
        time_ref_count = len(self._extract_time_references(query))
        if time_ref_count > 1:
            indicators.append(f"multiple_time_periods_{time_ref_count}")

        # Complex analysis keywords
        complex_keywords = ['correlation', 'regression', 'forecast', 'model', 'predict']
        for keyword in complex_keywords:
            if keyword in query:
                indicators.append(f"complex_analysis_{keyword}")

        # Query length
        word_count = len(query.split())
        if word_count > 30:
            indicators.append("long_query")

        return indicators