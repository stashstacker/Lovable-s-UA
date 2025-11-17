
import React from 'react';

interface DataPoint {
  time: number;
  value: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  color?: string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, color = '#facc15' }) => {
  if (data.length < 2) {
    return <div className="flex items-center justify-center h-full text-gray-500">Insufficient data</div>;
  }

  const width = 500;
  const height = 200;
  const padding = 20;

  const minTime = data[0].time;
  const maxTime = data[data.length - 1].time;
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const getX = (time: number) => {
    return ((time - minTime) / (maxTime - minTime)) * (width - 2 * padding) + padding;
  };

  const getY = (value: number) => {
    if (maxValue === minValue) {
      return height / 2;
    }
    return height - (((value - minValue) / (maxValue - minValue)) * (height - 2 * padding) + padding);
  };

  const path = data.map(point => `${getX(point.time)},${getY(point.value)}`).join(' L ');
  const areaPath = `M ${getX(data[0].time)},${height - padding} L ${path} L ${getX(data[data.length - 1].time)},${height - padding} Z`;
  
  const formatValue = (val: number): string => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };
  
  const yLabels = 5;
  const yAxisLabels = Array.from({ length: yLabels }).map((_, i) => {
    const value = minValue + (i / (yLabels - 1)) * (maxValue - minValue);
    return {
      value: formatValue(value),
      y: getY(value)
    };
  });
  
   const xLabels = 4;
   const xAxisLabels = Array.from({ length: xLabels }).map((_, i) => {
    const time = minTime + (i / (xLabels - 1)) * (maxTime - minTime);
    const date = new Date(time);
    return {
      value: `${date.getMonth() + 1}/${date.getDate()}`,
      x: getX(time)
    };
  });


  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {/* Y-axis labels and grid lines */}
      {yAxisLabels.map((label, i) => (
        <g key={i}>
          <line x1={padding} y1={label.y} x2={width - padding} y2={label.y} stroke="#374151" strokeWidth="0.5" />
          <text x={padding - 5} y={label.y + 3} fill="#9ca3af" fontSize="8" textAnchor="end">{label.value}</text>
        </g>
      ))}

       {/* X-axis labels */}
      {xAxisLabels.map((label, i) => (
         <text key={i} x={label.x} y={height - padding + 12} fill="#9ca3af" fontSize="8" textAnchor="middle">{label.value}</text>
      ))}

      {/* Area Gradient */}
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGradient)" />

      {/* Line Path */}
      <path d={`M ${path}`} fill="none" stroke={color} strokeWidth="2" />

      {/* End point circle */}
      <circle cx={getX(data[data.length - 1].time)} cy={getY(data[data.length - 1].value)} r="3" fill={color} />
    </svg>
  );
};
