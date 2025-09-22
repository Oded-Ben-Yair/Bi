"""
Power BI Service
Manages OAuth authentication and interactions with Power BI REST API
Specifically designed for DS-Axia dataset integration
"""

import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import logging
import json
from app.config import settings

logger = logging.getLogger(__name__)


class PowerBIService:
    """Service for interacting with Power BI REST API"""

    def __init__(self):
        self.settings = settings
        self.token_cache = {
            "token": None,
            "expires": None,
            "refresh_token": None
        }
        self.session: Optional[aiohttp.ClientSession] = None
        self.dataset_cache = {}

    async def initialize(self):
        """Initialize the service"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)

    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

    async def get_access_token(self) -> str:
        """
        Get Power BI access token using client credentials flow

        Returns:
            Access token string
        """
        # Check if we have a valid cached token
        if (self.token_cache["token"] and
            self.token_cache["expires"] and
            datetime.now() < self.token_cache["expires"]):
            logger.debug("Using cached Power BI token")
            return self.token_cache["token"]

        logger.info("Requesting new Power BI access token")

        if not self.session:
            await self.initialize()

        token_url = f"{self.settings.POWERBI_AUTHORITY}/oauth2/v2.0/token"

        data = {
            'client_id': self.settings.POWERBI_CLIENT_ID,
            'client_secret': self.settings.POWERBI_CLIENT_SECRET,
            'scope': self.settings.POWERBI_SCOPE,
            'grant_type': 'client_credentials'
        }

        try:
            async with self.session.post(token_url, data=data) as response:
                if response.status == 200:
                    token_data = await response.json()

                    # Cache the token
                    self.token_cache["token"] = token_data['access_token']
                    expires_in = token_data.get('expires_in', 3600)
                    self.token_cache["expires"] = datetime.now() + timedelta(seconds=expires_in - 60)

                    logger.info("Successfully obtained Power BI access token")
                    return self.token_cache["token"]
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get Power BI token: {response.status} - {error_text}")
                    raise Exception(f"Failed to get Power BI token: {error_text}")
        except Exception as e:
            logger.error(f"Error getting Power BI token: {str(e)}", exc_info=True)
            raise

    async def get_axia_dataset_details(self) -> Dict[str, Any]:
        """
        Get DS-Axia dataset details

        Returns:
            Dataset information dictionary
        """
        # Check cache first
        cache_key = f"dataset_{self.settings.POWERBI_AXIA_DATASET_ID}"
        if cache_key in self.dataset_cache:
            cache_entry = self.dataset_cache[cache_key]
            if datetime.now() < cache_entry["expires"]:
                logger.debug("Using cached dataset details")
                return cache_entry["data"]

        token = await self.get_access_token()
        headers = {'Authorization': f'Bearer {token}'}

        url = f"{self.settings.POWERBI_API_BASE}/groups/{self.settings.POWERBI_WORKSPACE_ID}/datasets/{self.settings.POWERBI_AXIA_DATASET_ID}"

        try:
            async with self.session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()

                    # Cache the result
                    self.dataset_cache[cache_key] = {
                        "data": data,
                        "expires": datetime.now() + timedelta(minutes=15)
                    }

                    logger.info("Successfully retrieved Axia dataset details")
                    return data
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get dataset details: {response.status} - {error_text}")
                    return {
                        "error": f"Failed to retrieve dataset: {response.status}",
                        "details": error_text
                    }
        except Exception as e:
            logger.error(f"Error getting dataset details: {str(e)}", exc_info=True)
            return {"error": str(e)}

    async def query_axia_data(self, dax_query: str) -> Dict[str, Any]:
        """
        Execute DAX query against DS-Axia dataset

        Args:
            dax_query: DAX query string

        Returns:
            Query results dictionary
        """
        token = await self.get_access_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        url = f"{self.settings.POWERBI_API_BASE}/groups/{self.settings.POWERBI_WORKSPACE_ID}/datasets/{self.settings.POWERBI_AXIA_DATASET_ID}/executeQueries"

        body = {
            "queries": [
                {
                    "query": dax_query
                }
            ],
            "serializerSettings": {
                "includeNulls": True
            }
        }

        logger.info(f"Executing DAX query on Axia dataset: {dax_query[:100]}...")

        try:
            async with self.session.post(url, headers=headers, json=body) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info("DAX query executed successfully")
                    return self._process_query_results(result)
                else:
                    error_text = await response.text()
                    logger.error(f"DAX query failed: {response.status} - {error_text}")
                    return {
                        "error": f"Query failed: {response.status}",
                        "details": error_text,
                        "query": dax_query
                    }
        except Exception as e:
            logger.error(f"Error executing DAX query: {str(e)}", exc_info=True)
            return {"error": str(e), "query": dax_query}

    def _process_query_results(self, raw_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process raw Power BI query results into a cleaner format

        Args:
            raw_results: Raw response from Power BI API

        Returns:
            Processed results dictionary
        """
        try:
            if "results" in raw_results and len(raw_results["results"]) > 0:
                result = raw_results["results"][0]

                if "tables" in result and len(result["tables"]) > 0:
                    table = result["tables"][0]

                    # Extract columns and rows
                    columns = [col["name"] for col in table.get("columns", [])]
                    rows = table.get("rows", [])

                    # Convert to more readable format
                    processed_data = []
                    for row in rows:
                        processed_row = {}
                        for i, column in enumerate(columns):
                            if f"{table['name']}[{column}]" in row:
                                processed_row[column] = row[f"{table['name']}[{column}]"]
                            elif column in row:
                                processed_row[column] = row[column]
                        processed_data.append(processed_row)

                    return {
                        "success": True,
                        "data": processed_data,
                        "columns": columns,
                        "row_count": len(processed_data)
                    }

            return {
                "success": True,
                "data": [],
                "message": "Query executed but returned no data"
            }
        except Exception as e:
            logger.error(f"Error processing query results: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"Error processing results: {str(e)}",
                "raw_results": raw_results
            }

    async def get_axia_tables(self) -> List[Dict[str, Any]]:
        """
        Get list of tables in the DS-Axia dataset

        Returns:
            List of table information
        """
        token = await self.get_access_token()
        headers = {'Authorization': f'Bearer {token}'}

        url = f"{self.settings.POWERBI_API_BASE}/groups/{self.settings.POWERBI_WORKSPACE_ID}/datasets/{self.settings.POWERBI_AXIA_DATASET_ID}/tables"

        try:
            async with self.session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Retrieved {len(data.get('value', []))} tables from Axia dataset")
                    return data.get("value", [])
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get tables: {response.status} - {error_text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting tables: {str(e)}", exc_info=True)
            return []

    async def refresh_axia_dataset(self) -> Dict[str, Any]:
        """
        Trigger a refresh of the DS-Axia dataset

        Returns:
            Refresh status information
        """
        token = await self.get_access_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        url = f"{self.settings.POWERBI_API_BASE}/groups/{self.settings.POWERBI_WORKSPACE_ID}/datasets/{self.settings.POWERBI_AXIA_DATASET_ID}/refreshes"

        body = {
            "notifyOption": "MailOnFailure"
        }

        try:
            async with self.session.post(url, headers=headers, json=body) as response:
                if response.status in [200, 202]:
                    logger.info("Dataset refresh triggered successfully")
                    return {
                        "success": True,
                        "message": "Dataset refresh initiated",
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to refresh dataset: {response.status} - {error_text}")
                    return {
                        "success": False,
                        "error": f"Refresh failed: {response.status}",
                        "details": error_text
                    }
        except Exception as e:
            logger.error(f"Error refreshing dataset: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def get_refresh_history(self, top: int = 5) -> List[Dict[str, Any]]:
        """
        Get refresh history for the DS-Axia dataset

        Args:
            top: Number of refresh records to retrieve

        Returns:
            List of refresh history records
        """
        token = await self.get_access_token()
        headers = {'Authorization': f'Bearer {token}'}

        url = f"{self.settings.POWERBI_API_BASE}/groups/{self.settings.POWERBI_WORKSPACE_ID}/datasets/{self.settings.POWERBI_AXIA_DATASET_ID}/refreshes?$top={top}"

        try:
            async with self.session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("value", [])
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get refresh history: {response.status} - {error_text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting refresh history: {str(e)}", exc_info=True)
            return []

    async def get_reports_using_axia(self) -> List[Dict[str, Any]]:
        """
        Get reports that use the DS-Axia dataset

        Returns:
            List of reports
        """
        token = await self.get_access_token()
        headers = {'Authorization': f'Bearer {token}'}

        url = f"{self.settings.POWERBI_API_BASE}/groups/{self.settings.POWERBI_WORKSPACE_ID}/reports"

        try:
            async with self.session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    reports = data.get("value", [])

                    # Filter reports that use the Axia dataset
                    axia_reports = [
                        report for report in reports
                        if report.get("datasetId") == self.settings.POWERBI_AXIA_DATASET_ID
                    ]

                    logger.info(f"Found {len(axia_reports)} reports using Axia dataset")
                    return axia_reports
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get reports: {response.status} - {error_text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting reports: {str(e)}", exc_info=True)
            return []

    def generate_embed_token(self, report_id: str) -> Dict[str, Any]:
        """
        Generate embed token for a report
        Note: This is a placeholder - actual implementation would require additional setup

        Args:
            report_id: Power BI report ID

        Returns:
            Embed configuration
        """
        # This would typically involve calling the GenerateToken API
        # For now, returning a structure that the frontend can use
        return {
            "embedUrl": f"https://app.powerbi.com/reportEmbed?reportId={report_id}&groupId={self.settings.POWERBI_WORKSPACE_ID}",
            "reportId": report_id,
            "datasetId": self.settings.POWERBI_AXIA_DATASET_ID,
            "message": "Embed token generation requires additional Power BI Embedded setup"
        }