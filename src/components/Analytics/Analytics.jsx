import React, { useState, useEffect } from 'react';
import { useTheme } from '../../ui/Settings/themeUtils';
import Card from '../../ui/common/Card';
import ChartComponent from '../../ui/common/ChartComponent';
import InteractivePieChart from '../../ui/common/InteractivePieChart';
import { EmailReportDialog } from '../../ui/common/EmailReportDialog';
import PageHeader from '../../ui/common/PageHeader';
import { TrendingUp, TrendingDown, Calendar, Download, Clock, BarChart2, AlertOctagon, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../../config.js';
import { useToast } from '../../ui/common/CustomToast';

export default function Analytics() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();

  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState({
    label: 'Last 7 Days',
    barData: [],
    pieData: [],
    insights: [],
    hotspots: []
  });
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/analytics?range=7d`);
        const result = await res.json();
        if (result.success && result.data) {
          setData(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
    const intervalId = setInterval(fetchAnalytics, 3000);

    return () => clearInterval(intervalId);
  }, [refreshKey]);

  return (
    <div className="flex flex-col gap-3 w-full h-full pb-6">
      {/* Header */}
      <PageHeader
        title="Traffic Analytics"
        subtitle="Historical data and predictive modeling"
        rightContent={
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setRefreshKey(prev => prev + 1);
                toast?.info?.("Refreshed", "Traffic analytics data updated");
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {/* Left Column */}
        <div className="flex flex-col gap-4">
          <ChartComponent
            type="bar"
            title={`Violation Trends (${data.label})`}
            data={data.barData || []}
            xAxisKey="month"
            bars={[
              { dataKey: "count", fill: theme.headerBg || "#3b82f6", name: "Violations" }
            ]}
          />
          <Card bgColor={themeUtils.getBgColor("card")} borderColor={themeUtils.getBorderColor()} padding="p-6" className="shadow-sm border-opacity-50 flex-1 transition-all duration-300 hover:shadow-md">
            <h3 className="text-xs font-bold tracking-widest mb-6 uppercase" style={{ color: theme.headerBg }}>Key Insights</h3>
            <div className="space-y-6">
              {data.insights.map((insight, idx) => {
                const IconComponent =
                  insight.icon === 'TrendingUp' ? TrendingUp :
                    insight.icon === 'TrendingDown' ? TrendingDown :
                      insight.icon === 'AlertOctagon' ? AlertOctagon :
                        Clock;

                return (
                  <div key={idx} className="flex items-start gap-4">
                    <div className={`p-2 rounded-full bg-black/5 dark:bg-white/5 flex-shrink-0`}>
                      <IconComponent className={`w-5 h-5 ${insight.color}`} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: themeUtils.getTextColor(true) }}>{insight.title}</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: themeUtils.getTextColor(false) }}>{insight.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          <Card bgColor={themeUtils.getBgColor("card")} borderColor={themeUtils.getBorderColor()} padding="p-6" className="shadow-sm border-opacity-50 h-[400px] flex flex-col transition-all duration-300 hover:shadow-md">
            <h3 className="text-xs font-bold tracking-widest mb-2 uppercase" style={{ color: theme.headerBg }}>Violation Breakdown ({data.label})</h3>
            <div className="flex-1 flex justify-center items-center relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" style={{ borderColor: theme.headerBg, borderBottomColor: 'transparent' }}></div>
                </div>
              ) : (
                <InteractivePieChart data={data.pieData} themeUtils={themeUtils} loading={false} />
              )}
            </div>
          </Card>

          <Card bgColor={themeUtils.getBgColor("card")} borderColor={themeUtils.getBorderColor()} padding="p-6" className="shadow-sm border-opacity-50 flex-1 transition-all duration-300 hover:shadow-md">
            <h3 className="text-xs font-bold tracking-widest mb-4 uppercase" style={{ color: theme.headerBg }}>Top Violation Hotspots</h3>
            <div className="space-y-3">
              {data.hotspots.map((hotspot, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-black/5 dark:bg-white/5 transition-colors hover:bg-black/10 dark:hover:bg-white/10 group">
                  <span className="text-sm font-semibold flex items-center gap-2" style={{ color: themeUtils.getTextColor(true) }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 group-hover:opacity-100 transition-opacity"></span>
                    {hotspot.loc}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold w-12 text-right" style={{ color: themeUtils.getTextColor(false) }}>{hotspot.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <EmailReportDialog
        visible={reportDialogOpen}
        onHide={() => setReportDialogOpen(false)}
        reportName={`Traffic Analytics - ${data.label}`}
      />
    </div>
  );
}
