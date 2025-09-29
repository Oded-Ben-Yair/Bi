import React, { memo, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Menu, X, Grid, BarChart3, Activity, Users, Settings } from 'lucide-react';

// Lazy load components for code splitting
const RevenueGrowth = lazy(() => import('./dashboard/RevenueGrowth'));
const ProfitabilityKPI = lazy(() => import('./dashboard/ProfitabilityKPI'));
const CashFlowAnalysis = lazy(() => import('./dashboard/CashFlowAnalysis'));
const OperationalMetrics = lazy(() => import('./dashboard/OperationalMetrics'));
const ExecutiveSummary = lazy(() => import('./dashboard/ExecutiveSummary'));
const PredictiveForecasts = lazy(() => import('./analytics/PredictiveForecasts'));
const AnomalyDetection = lazy(() => import('./analytics/AnomalyDetection'));
const ScenarioSimulator = lazy(() => import('./analytics/ScenarioSimulator'));
const ChurnPrediction = lazy(() => import('./analytics/ChurnPrediction'));
const TrendAnalyzer = lazy(() => import('./analytics/TrendAnalyzer'));

interface CEODashboardProps {
  className?: string;
}

type DashboardView = 'overview' | 'financial' | 'operational' | 'analytics' | 'predictions';

const CEODashboard: React.FC<CEODashboardProps> = memo(({
  className = ''
}) => {
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedWidget] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Loading component
  const LoadingWidget = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  const navigationItems = [
    { id: 'overview', label: 'Executive Overview', icon: Crown, color: 'text-amber-600' },
    { id: 'financial', label: 'Financial Performance', icon: BarChart3, color: 'text-blue-600' },
    { id: 'operational', label: 'Operations', icon: Users, color: 'text-green-600' },
    { id: 'analytics', label: 'Predictive Analytics', icon: Activity, color: 'text-purple-600' },
    { id: 'predictions', label: 'Risk & Forecasts', icon: Grid, color: 'text-red-600' }
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Executive Summary - Full Width */}
      <Suspense fallback={<LoadingWidget />}>
        <ExecutiveSummary
          className={expandedWidget === 'summary' ? 'col-span-full' : ''}
        />
      </Suspense>

      {/* Key Financial Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingWidget />}>
          <RevenueGrowth
            className={expandedWidget === 'revenue' ? 'lg:col-span-2' : ''}
          />
        </Suspense>
        <Suspense fallback={<LoadingWidget />}>
          <ProfitabilityKPI
            className={expandedWidget === 'profitability' ? 'lg:col-span-2' : ''}
          />
        </Suspense>
      </div>

      {/* Operational Overview */}
      <Suspense fallback={<LoadingWidget />}>
        <OperationalMetrics
          className={expandedWidget === 'operations' ? 'col-span-full' : ''}
        />
      </Suspense>
    </div>
  );

  const renderFinancial = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingWidget />}>
          <RevenueGrowth />
        </Suspense>
        <Suspense fallback={<LoadingWidget />}>
          <ProfitabilityKPI />
        </Suspense>
      </div>
      <Suspense fallback={<LoadingWidget />}>
        <CashFlowAnalysis />
      </Suspense>
      <Suspense fallback={<LoadingWidget />}>
        <TrendAnalyzer />
      </Suspense>
    </div>
  );

  const renderOperational = () => (
    <div className="space-y-6">
      <Suspense fallback={<LoadingWidget />}>
        <OperationalMetrics />
      </Suspense>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingWidget />}>
          <ChurnPrediction />
        </Suspense>
        <Suspense fallback={<LoadingWidget />}>
          <AnomalyDetection />
        </Suspense>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <Suspense fallback={<LoadingWidget />}>
        <PredictiveForecasts />
      </Suspense>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingWidget />}>
          <ScenarioSimulator />
        </Suspense>
        <Suspense fallback={<LoadingWidget />}>
          <TrendAnalyzer />
        </Suspense>
      </div>
    </div>
  );

  const renderPredictions = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingWidget />}>
          <AnomalyDetection />
        </Suspense>
        <Suspense fallback={<LoadingWidget />}>
          <ChurnPrediction />
        </Suspense>
      </div>
      <Suspense fallback={<LoadingWidget />}>
        <PredictiveForecasts />
      </Suspense>
    </div>
  );

  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview': return renderOverview();
      case 'financial': return renderFinancial();
      case 'operational': return renderOperational();
      case 'analytics': return renderAnalytics();
      case 'predictions': return renderPredictions();
      default: return renderOverview();
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 ${className}`}>
      {/* Mobile Navigation Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-amber-100 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-amber-600 hover:bg-amber-50"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">CEO Dashboard</h1>
                  <p className="text-xs text-gray-500 hidden sm:block">Executive Intelligence Platform</p>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50"
              >
                <Settings className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* View Status */}
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Real-time</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <motion.nav
          initial={false}
          animate={{
            x: isMobileMenuOpen ? 0 : '-100%'
          }}
          className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-amber-100 lg:relative lg:translate-x-0 lg:z-0"
        >
          <div className="p-4 pt-20 lg:pt-4">
            <div className="space-y-2">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentView === item.id;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id as DashboardView);
                      setIsMobileMenuOpen(false);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-900 border border-amber-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 ${isActive ? 'text-amber-600' : item.color}`} />
                    <span className="font-medium">{item.label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Quick Stats in Sidebar */}
            <div className="mt-8 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <h3 className="text-sm font-semibold text-amber-900 mb-2">Quick Stats</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Revenue Growth:</span>
                  <span className="font-semibold text-green-600">+19.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Alerts:</span>
                  <span className="font-semibold text-red-600">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Forecast Confidence:</span>
                  <span className="font-semibold text-blue-600">84.2%</span>
                </div>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Page Title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {navigationItems.find(item => item.id === currentView)?.label}
              </h2>
              <p className="text-gray-600">
                {currentView === 'overview' && 'Executive summary and key performance indicators'}
                {currentView === 'financial' && 'Revenue, profitability, and cash flow analysis'}
                {currentView === 'operational' && 'Team performance and customer retention metrics'}
                {currentView === 'analytics' && 'Predictive modeling and scenario analysis'}
                {currentView === 'predictions' && 'Risk assessment and forecasting insights'}
              </p>
            </motion.div>

            {/* Dashboard Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderCurrentView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-100 mt-12">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>© 2024 Seekapa BI Agent</span>
              <span>•</span>
              <span>CEO Dashboard v4.0</span>
              <span>•</span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>All systems operational</span>
              </span>
            </div>
            <div className="mt-2 sm:mt-0">
              <span>Last updated: {new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
});

CEODashboard.displayName = 'CEODashboard';

export default CEODashboard;