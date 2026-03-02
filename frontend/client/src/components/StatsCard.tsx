import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  delay?: number;
  description?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'text-indigo-600',
  iconBg = 'bg-indigo-100 dark:bg-indigo-900',
  delay = 0,
  description,
}: StatsCardProps) {
  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ 
        y: -4, 
        scale: 1.02,
        transition: { type: "spring", stiffness: 300, damping: 20 }
      }}
      className="group bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{title}</h3>
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
          className={`p-2.5 rounded-xl ${iconBg} shadow-sm`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.1 }}
        className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight"
      >
        {value}
      </motion.p>
      {change && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.2 }}
          className={`text-sm font-medium ${changeColors[changeType]} flex items-center gap-1.5`}
        >
          {changeType === 'positive' && <span className="text-lg">↗</span>}
          {changeType === 'negative' && <span className="text-lg">↘</span>}
          {change}
        </motion.p>
      )}
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium leading-relaxed">{description}</p>
      )}
    </motion.div>
  );
}

interface StatsGridProps {
  children: ReactNode;
}

export function StatsGrid({ children }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {children}
    </div>
  );
}
