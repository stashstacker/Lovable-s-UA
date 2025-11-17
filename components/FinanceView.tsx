import React, { useMemo } from 'react';
import { GameState, Transaction } from '../types';
import { SimpleLineChart } from './SimpleLineChart';
import { DollarSignIcon } from './icons';

interface FinanceViewProps {
  gameState: GameState;
  worldTime: Date;
}

const TransactionRow: React.FC<{ label: string, amount: number, isIncome: boolean }> = ({ label, amount, isIncome }) => {
    const color = isIncome ? 'text-green-400' : 'text-red-400';
    const prefix = isIncome ? '+' : '-';
    return (
        <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
            <span className="text-gray-300">{label}</span>
            <span className={`font-mono font-semibold ${color}`}>{prefix} ${amount.toLocaleString()}</span>
        </div>
    );
}

export const FinanceView: React.FC<FinanceViewProps> = ({ gameState, worldTime }) => {
    const { transactionLog, cash } = gameState;

    const timePeriods = useMemo(() => {
        const now = worldTime.getTime();
        const last24h = now - 24 * 60 * 60 * 1000;
        const last7d = now - 7 * 24 * 60 * 60 * 1000;
        return { now, last24h, last7d };
    }, [worldTime]);

    const recentTransactions = useMemo(() => {
        return transactionLog.filter(t => t.timestamp.getTime() >= timePeriods.last24h);
    }, [transactionLog, timePeriods.last24h]);
    
    // fix: Correctly typed the initial value for the reduce function to prevent type errors.
    const aggregateTransactions = (transactions: Transaction[]) => {
        // FIX: Correctly typed the initial value for the reduce function to prevent type errors.
        const initialValue: Record<string, { income: number; expense: number }> = {};
        return transactions.reduce((acc, t) => {
            const key = t.category;
            if (!acc[key]) {
                acc[key] = { income: 0, expense: 0 };
            }
            if (t.type === 'income') {
                acc[key].income += t.amount;
            } else {
                acc[key].expense += t.amount;
            }
            return acc;
        }, initialValue);
    };

    const aggregated = useMemo(() => aggregateTransactions(recentTransactions), [recentTransactions]);
    
    const totalIncome24h = useMemo(() => recentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0), [recentTransactions]);
    const totalExpense24h = useMemo(() => recentTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0), [recentTransactions]);
    const netProfit24h = totalIncome24h - totalExpense24h;

    const chartData = useMemo(() => {
        const data: { time: number; value: number }[] = [];
        let historicalCash = cash;
        
        const relevantLogs = transactionLog
            .filter(t => t.timestamp.getTime() >= timePeriods.last7d)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        data.push({ time: worldTime.getTime(), value: historicalCash });

        for (const log of relevantLogs) {
            if (log.type === 'income') {
                historicalCash -= log.amount;
            } else {
                historicalCash += log.amount;
            }
            data.push({ time: log.timestamp.getTime(), value: historicalCash });
        }
        
        if (data.length > 0) {
            const oldestDataPoint = data[data.length - 1];
            if (oldestDataPoint.time > timePeriods.last7d) {
                data.push({ time: timePeriods.last7d, value: oldestDataPoint.value });
            }
        } else {
             data.push({ time: timePeriods.last7d, value: cash });
        }

        return data.reverse();
    }, [transactionLog, cash, worldTime, timePeriods.last7d]);

    return (
        <div>
            <h2 className="font-title text-2xl text-yellow-300 mb-4 border-b-2 border-yellow-700/50 pb-2">Financial Ledger</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ledger */}
                <div className="lg:col-span-1 bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                    <h3 className="font-bold text-lg text-yellow-100 mb-3">Last 24 Hours Report</h3>
                    <div className="space-y-3">
                        {Object.entries(aggregated).map(([category, { income, expense }]) => (
                            <div key={category}>
                                {income > 0 && <TransactionRow label={category} amount={Math.round(income)} isIncome={true} />}
                                {expense > 0 && <TransactionRow label={category} amount={Math.round(expense)} isIncome={false} />}
                            </div>
                        ))}
                         {recentTransactions.length === 0 && <p className="text-sm text-center text-gray-500 py-4 italic">No transactions in the last 24 hours.</p>}
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-yellow-800/50">
                       <div className="flex justify-between items-center text-sm font-semibold">
                           <span className="text-gray-300">Net Profit (24h):</span>
                           <span className={`font-mono ${netProfit24h >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                            {netProfit24h >= 0 ? '+' : '-'} ${Math.abs(Math.round(netProfit24h)).toLocaleString()}
                           </span>
                       </div>
                    </div>
                </div>

                {/* Chart and Summary */}
                <div className="lg:col-span-2 bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                    <h3 className="font-bold text-lg text-yellow-100 mb-1">Cash Balance (Last 7 Days)</h3>
                    <p className="text-xs text-gray-400 mb-4">A summary of your liquid assets over the past week.</p>
                    <div className="h-64 w-full bg-black/20 p-2 rounded-md">
                        {chartData.length > 1 ? (
                            <SimpleLineChart data={chartData} color="#f59e0b" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">Not enough data to display chart.</div>
                        )}
                    </div>
                     <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                        <div className="bg-black/20 p-3 rounded-md">
                            <p className="text-xs text-gray-400 uppercase">Total Income (24h)</p>
                            <p className="text-2xl font-bold text-green-400 font-mono">+${Math.round(totalIncome24h).toLocaleString()}</p>
                        </div>
                         <div className="bg-black/20 p-3 rounded-md">
                            <p className="text-xs text-gray-400 uppercase">Total Expenses (24h)</p>
                            <p className="text-2xl font-bold text-red-400 font-mono">-${Math.round(totalExpense24h).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};