import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart, Calendar, Users, DollarSign, AlertCircle } from 'lucide-react';

interface SuggestedPromptsProps {
  onPromptClick: (prompt: string) => void;
}

const prompts = [
  {
    icon: TrendingUp,
    title: 'Analyze Trends',
    prompt: 'Show me the sales trends for the last quarter in the DS-Axia dataset',
    color: 'text-green-500',
  },
  {
    icon: BarChart,
    title: 'Performance Metrics',
    prompt: 'What are the top performing products by revenue in DS-Axia?',
    color: 'text-blue-500',
  },
  {
    icon: Calendar,
    title: 'YoY Comparison',
    prompt: 'Compare this year\'s performance with last year using DS-Axia data',
    color: 'text-purple-500',
  },
  {
    icon: Users,
    title: 'Customer Analysis',
    prompt: 'Analyze customer segments and their contribution to revenue in DS-Axia',
    color: 'text-orange-500',
  },
  {
    icon: DollarSign,
    title: 'Revenue Forecast',
    prompt: 'Generate a revenue forecast for the next quarter based on DS-Axia trends',
    color: 'text-emerald-500',
  },
  {
    icon: AlertCircle,
    title: 'Anomaly Detection',
    prompt: 'Detect any anomalies or unusual patterns in the DS-Axia dataset',
    color: 'text-red-500',
  },
];

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onPromptClick }) => {
  return (
    <div className="px-4">
      <h3 className="text-sm text-copilot-text-muted mb-4">Suggested prompts</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {prompts.map((item, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPromptClick(item.prompt)}
            className="p-4 bg-copilot-dark border border-copilot-border rounded-lg
                     hover:border-copilot-primary/50 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-copilot-darker ${item.color}`}>
                <item.icon size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-copilot-text-primary mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-copilot-text-secondary line-clamp-2">
                  {item.prompt}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-copilot-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Click to use this prompt →
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedPrompts;